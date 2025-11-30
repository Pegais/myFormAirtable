const axios = require('axios');
const UserModel = require('../models/user.model');
/**
 * refresh access token if it is expired;
 * @param {string} accessToken - the access token for the user;
 * @returns {Promise<String>} - the refreshed access token;
 */

const refreshAccessToken = async (userId) => {
    try {
        const user = await UserModel.findOne({userId});
        if(!user || !user.refreshToken){
            throw new Error('User not found or no refresh token');
        }
        const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.refreshToken,
            client_id: process.env.AIRTABLE_CLIENT_ID,
            client_secret: process.env.AIRTABLE_CLIENT_SECRET,
        });
        const credentials = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`).toString('base64');
        const response = await axios.post(`${process.env.Airtable_tokenUrl}`, tokenParams.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`
            }
        });
        //updating the user with new access token;
        user.accessToken = response.data.access_token;
        if(response.data.refresh_token){
            user.refreshToken = response.data.refresh_token;
        }
        await user.save();
        return user.accessToken;
    } catch (error) {
        console.error('Error refreshing access token:', error.response?.data || error.message);
        throw new Error('Failed to refresh access token');
    }
}

module.exports = {
    refreshAccessToken
}