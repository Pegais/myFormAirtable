const { default: axios } = require("axios");
const userModel = require("../models/user.model");
const { VerificationGenerator, hashFromVerifier, createRandomState } = require('../utils/hepler')
const jwt = require("jsonwebtoken");

// storing verifier temporarily;
const pkce = {};
const tempStateStore = {};

const Auth = async (req, res, next) => {
    console.log(req.body, "insideAUth");
    const verifier = VerificationGenerator();
    const challenge = hashFromVerifier(verifier);
    const tempStore = createRandomState();
    tempStateStore[req.sessionID] = tempStore;

    pkce[req.sessionID] = verifier;
    try {
        const baseUrl = process.env.Airtable_BASEURL;
        const parameters = new URLSearchParams({
            client_id: process.env.AIRTABLE_CLIENT_ID,
            response_type: "code",
            redirect_uri: `${process.env.BACKEND_URL}/auth/airtable/callback`,
            scope: "data.records:read data.records:write schema.bases:read webhook:manage",
            state: `${tempStore}`,
            code_challenge: challenge,
            code_challenge_method: "S256"
        })
        res.redirect(`${baseUrl}?${parameters.toString()}`);
    } catch (error) {
        console.error("Oauth error intiated",error);
        delete pkce[req.sessionID];
        delete tempStateStore[req.sessionID];
        next(error);
    }
}

const authCallback = async (req, res, next) => {
    try {

        //check for req.query 
        console.log("calllback received: ",req.query);
        console.log("sessionID: ",req.sessionID);
        
        //checking if there is any error from airtable
        if(req.query.error){
            console.error("Oauth error from airtable:",req.query.error,req.query.error_description);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${req.query.error}`);
        }
        
        //validating if state exists 
        if(!req.query.code){
            console.error("No code found in the request");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        }
        
        if (!req.query.state || req.query.state !== tempStateStore[req.sessionID]) {
            delete pkce[req.sessionID];
            delete tempStateStore[req.sessionID];
            return res.status(400).redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }

        const code = req.query.code;

        //taking verifier from session store;
        const verifier = pkce[req.sessionID];
        //handling if verifier does not exist;
        if(!verifier){
           
            delete tempStateStore[req.sessionID];
            return res.status(400).send("verifier not found,try login again");
        }
     //MAJOR bug we need form-urlencoded for airtable;
     const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier, 
        redirect_uri: `${process.env.BACKEND_URL}/auth/airtable/callback`
     })
     const credentials = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`).toString('base64');
     const responseToken = await axios.post(`${process.env.Airtable_tokenUrl}`, tokenParams.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
        }
     })
     const accessToken = responseToken.data.access_token;
        //fetching airtable account info;

        const profileResponse = await axios.get('https://api.airtable.com/v0/meta/whoami', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        console.log(profileResponse.data, "aritable profile");
        const user = await userModel.findOneAndUpdate({
            userId: profileResponse.data.id
        },
            {
                profile: profileResponse.data,
                accessToken:accessToken,
                refreshToken: responseToken.data.refresh_token || null,

                lastActivity: new Date()
            },
            {
                upsert: true, new: true
            }


        );

        //creating jwt token and sending as cookie;
        const token = jwt.sign({
            userId: user.userId
        }, process.env.JWT_SECRET, { expiresIn: '1h' });

        //setting response cookie with jwt;
        res.cookie('token', token, { 
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite:'lax',
            maxAge:60*60*1000 //1 hour

        });
        
        delete pkce[req.sessionID];
        delete tempStateStore[req.sessionID];
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);


    } catch (error) {
        console.error(error);
        delete pkce[req.sessionID];
        delete tempStateStore[req.sessionID];
        res.status(500).send(`${process.env.FRONTEND_URL}/login?error=Authentication failed`);

    }

}

module.exports = { Auth, authCallback }