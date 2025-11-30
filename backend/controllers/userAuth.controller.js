const { default: axios } = require("axios");
const userModel = require("../models/user.model");
const oauthStateModel = require("../models/oAUthState.model");
const { VerificationGenerator, hashFromVerifier, createRandomState } = require('../utils/hepler')
const jwt = require("jsonwebtoken");

// storing verifier temporarily;


const Auth = async (req, res, next) => {
    console.log(req.body, "insideAUth");
    const verifier = VerificationGenerator();
    const challenge = hashFromVerifier(verifier);
    const tempStore = createRandomState();
    await oauthStateModel.create({
        state: tempStore,
        codeVerifier: verifier
    })
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
        console.error("Oauth error intiated", error);
        delete pkce[req.sessionID];
        delete tempStateStore[req.sessionID];
        next(error);
    }
}

const authCallback = async (req, res, next) => {
    try {

        //check for req.query 
        console.log("calllback received: ", req.query);
        console.log("sessionID: ", req.sessionID);

        //checking if there is any error from airtable
        if (req.query.error) {
            console.error("Oauth error from airtable:", req.query.error, req.query.error_description);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${req.query.error}`);
        }

        //validating if state exists 
        if (!req.query.code) {
            console.error("No code found in the request");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        }

        if (!req.query.state || req.query.state !== tempStateStore[req.sessionID]) {
            delete pkce[req.sessionID];
            delete tempStateStore[req.sessionID];
            return res.status(400).redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }
        //find state in the database;
        const oauthState = await oauthStateModel.findOne({ state: req.query.state });
        if (!oauthState) {
            console.error("State not found in database:", req.query.state);
            console.error("This could mean: 1) State expired (10 min TTL), 2) Server restarted, 3) Invalid state");
            return res.status(400).redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }

        const code = req.query.code;

        //taking verifier from session store;
        const verifier =oauthState.codeVerifier;
        //handling if verifier does not exist;
        await oauthStateModel.deleteOne({ state: req.query.state });
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
                accessToken: accessToken,
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
            secure: true,
            sameSite: 'none',
            maxAge: 60 * 60 * 1000,
            path: '/', //1 hour

        });

       
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);


    } catch (error) {
        console.error(error);
     if(req.query.state){
        await oauthStateModel.deleteOne({ state: req.query.state }).catch(()=>{});
     }
        res.status(500).send(`${process.env.FRONTEND_URL}/login?error=Authentication failed`);

    }

}

const checkAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token;

        // If no token, user is not authenticated
        if (!token) {
            return res.status(401).json({ authenticated: false, message: "No token found" });
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user exists
        const user = await userModel.findOne({ userId: decoded.userId });
        if (!user) {
            return res.status(401).json({ authenticated: false, message: "User not found" });
        }

        // User is authenticated
        return res.status(200).json({ authenticated: true, user: { userId: user.userId } });
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({ authenticated: false, message: "Invalid or expired token" });
        }
        console.error("Error checking auth:", error);
        return res.status(500).json({ authenticated: false, message: "Authentication check failed" });
    }
};



module.exports = { Auth, authCallback, checkAuth };