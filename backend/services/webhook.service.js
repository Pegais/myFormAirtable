const axios = require('axios');
const { refreshAccessToken } = require('./tokenRefreshService');
/**
 * Registering a webhook with airtabel;
 * A webhook is a url that airtable will call when certain events happen in the base;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to register the webhook in;
 * @param {string} webhookUrl - the url to call when the event happens;
 * @returns {Promise<Object>} - the registered webhook;
 */
const registerWebhook = async (accessToken, baseId,tableId, webhookUrl,userId=null) => {
    const makeRequest=async(token)=>{
        const response = await axios.post(`https://api.airtable.com/v0/bases/${baseId}/webhooks`, {
            notificationUrl: webhookUrl,
            specification: {
                options: {
                    filters: {
                        dataTypes: ['tableData'],
                        recordChangeScope: tableId
                    }
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.id; //webhook id;
    }
    try {
      return await makeRequest(accessToken);
    } catch (error) {
        if(error.response?.status === 401 && userId){
            try {
                console.log('Refreshing access token for user:', userId);
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Error registering webhook:', error.response?.data || error.message);
        throw new Error('Failed to register webhook');
    }
};
/**
 * deleting a webhook with airtable;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to delete the webhook from;
 * @param {string} webhookId - the id of the webhook to delete;
 * @returns {Promise<Object>} - the deleted webhook;
 */
const deleteWebhook = async (accessToken, baseId, webhookId,userId=null) => {
    const makeRequest=async(token)=>{
        await axios.delete(`https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Webhook deleted successfully');
    }
    try {
        return await makeRequest(accessToken);
    } catch (error) {
        if(error.response?.status === 401 && userId){
            try {
                console.log('Refreshing access token for user:', userId);
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Error deleting webhook:', error.response?.data || error.message);
        console.warn('Webhook deletion failed, continuing with other operations');
    }
};




/**
 * Fetch webhook payloads from Airtable
 * Airtable sends notifications, but we need to fetch the actual payloads separately
 * @param {string} accessToken - the access token for the user
 * @param {string} baseId - the id of the base
 * @param {string} webhookId - the id of the webhook
 * @param {string} cursor - optional cursor to fetch specific payloads (null for latest)
 * @param {string} userId - optional userId for token refresh
 * @returns {Promise<Object>} - the webhook payloads with events
 */
const fetchWebhookPayloads = async (accessToken, baseId, webhookId, cursor = null, userId = null) => {
    const makeRequest = async (token) => {
        let url = `https://api.airtable.com/v0/bases/${baseId}/webhooks/${webhookId}/payloads`;
        const params = {};
        
        if (cursor) {
            params.cursor = cursor;
        }
        
        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            params: params
        });
        
        return response.data;
    };

    try {
        return await makeRequest(accessToken);
    } catch (error) {
        if (error.response?.status === 401 && userId) {
            try {
                console.log('Refreshing access token for webhook payload fetch:', userId);
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        console.error('Error fetching webhook payloads:', error.response?.data || error.message);
        throw new Error('Failed to fetch webhook payloads');
    }
};






module.exports = {
    registerWebhook,
    deleteWebhook,
    fetchWebhookPayloads
}