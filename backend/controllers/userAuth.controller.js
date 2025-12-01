const { default: axios } = require("axios");
const userModel = require("../models/user.model");
const oauthStateModel = require("../models/oAUthState.model");
const { VerificationGenerator, hashFromVerifier, createRandomState } = require('../utils/hepler')
const jwt = require("jsonwebtoken");

const Auth = async (req, res, next) => {
    try {
        // console.log("=== OAuth Initiation ===");
        const verifier = VerificationGenerator();
        const challenge = hashFromVerifier(verifier);
        const tempStore = createRandomState();

        // Store in MongoDB (moved inside try-catch)
        await oauthStateModel.create({
            state: tempStore,
            codeVerifier: verifier
        });

        // console.log("State stored in DB:", tempStore);

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
        console.error("OAuth initiation error:", error);
        // If state was created, try to clean it up
        // (Not critical if it fails)
        next(error);
    }
}

const authCallback = async (req, res, next) => {
    try {
        // console.log("=== OAuth Callback ===");
        // console.log("Query received:", req.query);

        //checking if there is any error from airtable
        if (req.query.error) {
            console.error("OAuth: Error from Airtable:", req.query.error, req.query.error_description);
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=${req.query.error}`);
        }

        //validating if code exists
        if (!req.query.code) {
            console.error("OAuth: No code found in the request");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_code`);
        }

        //validating if state exists
        if (!req.query.state) {
            console.error("OAuth: No state in query");
            return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_state`);
        }

        // Find state in MongoDB (REMOVED the old tempStateStore check)
        const oauthState = await oauthStateModel.findOne({ state: req.query.state });
        if (!oauthState) {
            console.error("OAuth: State not found in database:", req.query.state);
            return res.status(400).redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
        }

        const code = req.query.code;
        const verifier = oauthState.codeVerifier;

        // Delete the state from DB (one-time use) - do this BEFORE token exchange
        await oauthStateModel.deleteOne({ state: req.query.state });

        // Exchange code for token
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            code_verifier: verifier,
            redirect_uri: `${process.env.BACKEND_URL}/auth/airtable/callback`
        })
        const credentials = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`).toString('base64');

        // console.log("Exchanging code for token...");
        const responseToken = await axios.post(`${process.env.Airtable_tokenUrl}`, tokenParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`
            }
        })
        const accessToken = responseToken.data.access_token;

        //fetching airtable account info;
        // console.log("Fetching user profile from Airtable...");
        const profileResponse = await axios.get('https://api.airtable.com/v0/meta/whoami', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        // console.log("Airtable profile:", profileResponse.data);

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

        // console.log("Setting cookie and redirecting...");
        //setting response cookie with jwt;
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 60 * 60 * 1000, // 1 hour
            path: '/'
        });

        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

    } catch (error) {
        console.error("OAuth: Callback error:", error.message);
        // console.error("Error stack:", error.stack);
        if (error.response) {
            console.error("OAuth: Response status:", error.response.status);
            // console.error("Response data:", error.response.data);
        }

        // Clean up state if it exists
        if (req.query.state) {
            await oauthStateModel.deleteOne({ state: req.query.state }).catch(() => { });
        }

        res.status(500).redirect(`${process.env.FRONTEND_URL}/login?error=Authentication failed`);
    }
}

const checkAuth = async (req, res, next) => {
    try {
        // console.log("=== Auth Check ===");
        // console.log("Request origin:", req.headers.origin);
        // console.log("Cookies object:", req.cookies);
        // console.log("Cookies keys:", req.cookies ? Object.keys(req.cookies) : 'No cookies object');
        // console.log("Cookie header:", req.headers.cookie);
        // console.log("Has cookie-parser?", typeof req.cookies !== 'undefined');
        
        const token = req.cookies?.token;
        // console.log("Token from cookies:", token ? "✅ FOUND" : "❌ NOT FOUND");

        if (!token) {
            // console.log("❌ No token found in cookies");
            return res.status(200).json({ authenticated: false, message: "No token found" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findOne({ userId: decoded.userId });
        
        if (!user) {
            return res.status(200).json({ authenticated: false, message: "User not found" });
        }

        return res.status(200).json({ authenticated: true, user: { userId: user.userId } });
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(200).json({ authenticated: false, message: "Invalid or expired token" });
        }
        console.error("Error checking auth:", error);
        return res.status(500).json({ authenticated: false, message: "Authentication check failed" });
    }
};

module.exports = { Auth, authCallback, checkAuth };