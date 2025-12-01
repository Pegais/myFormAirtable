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
const registerWebhook = async (accessToken, baseId, tableId, webhookUrl, userId = null) => {
    const makeRequest = async (token) => {
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
        // Handle token refresh
        if (error.response?.status === 401 && userId) {
            try {
                // console.log('Refreshing access token for user:', userId);
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Webhook: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        
        // Handle webhook limit error - try to clean up orphaned webhooks and retry
        if (error.response?.data?.type === 'TOO_MANY_WEBHOOKS_BY_OAUTH_INTEGRATION_IN_BASE' && userId) {
            console.error('Webhook: Reached webhook limit. Attempting to clean up orphaned webhooks...');
            try {
                const deletedCount = await cleanupOrphanedWebhooks(accessToken, baseId, userId);
                if (deletedCount > 0) {
                    console.error(`Webhook: Cleaned up ${deletedCount} orphaned webhook(s). Retrying registration...`);
                    // Retry registration after cleanup
                    return await makeRequest(accessToken);
                } else {
                    throw new Error('Webhook limit reached and no orphaned webhooks found to clean up. Maximum 2 webhooks allowed per base.');
                }
            } catch (cleanupError) {
                throw new Error('Webhook limit reached. Please delete existing webhooks manually or contact support.');
            }
        }
        
        console.error('Webhook: Error registering webhook:', error.response?.data || error.message);
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
        // console.log('Webhook deleted successfully');
    }
        try {
            return await makeRequest(accessToken);
        } catch (error) {
            if(error.response?.status === 401 && userId){
                try {
                    // console.log('Refreshing access token for user:', userId);
                    const newAccessToken = await refreshAccessToken(userId);
                    return await makeRequest(newAccessToken);
                } catch (refreshError) {
                    console.error('Webhook: Error refreshing token for deletion:', refreshError.response?.data || refreshError.message);
                    throw new Error('Failed to refresh access token');
                }
            }   
            console.error('Webhook: Error deleting webhook:', error.response?.data || error.message);
            // console.warn('Webhook deletion failed, continuing with other operations');
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
/**
 * List all webhooks for a base
 * @param {string} accessToken - the access token for the user
 * @param {string} baseId - the id of the base
 * @param {string} userId - optional userId for token refresh
 * @returns {Promise<Array>} - array of webhooks
 */
const listWebhooks = async (accessToken, baseId, userId = null) => {
    const makeRequest = async (token) => {
        const response = await axios.get(`https://api.airtable.com/v0/bases/${baseId}/webhooks`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.webhooks || [];
    };

    try {
        return await makeRequest(accessToken);
    } catch (error) {
        if (error.response?.status === 401 && userId) {
            try {
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Webhook: Error refreshing token for listing webhooks:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        console.error('Webhook: Error listing webhooks:', error.response?.data || error.message);
        throw new Error('Failed to list webhooks');
    }
};

/**
 * Clean up orphaned webhooks (webhooks not associated with any form in MongoDB)
 * @param {string} accessToken - the access token for the user
 * @param {string} baseId - the id of the base
 * @param {string} userId - optional userId for token refresh
 * @returns {Promise<number>} - number of webhooks deleted
 */
const cleanupOrphanedWebhooks = async (accessToken, baseId, userId = null) => {
    try {
        const FormModel = require('../models/form.model');
        
        // Get all webhooks from Airtable
        const webhooks = await listWebhooks(accessToken, baseId, userId);
        
        // Get all active webhook IDs from MongoDB
        const forms = await FormModel.find({ baseId, webhookId: { $ne: null } }, { webhookId: 1 });
        const activeWebhookIds = new Set(forms.map(f => f.webhookId).filter(Boolean));
        
        // Find orphaned webhooks (not in MongoDB)
        const orphanedWebhooks = webhooks.filter(wh => !activeWebhookIds.has(wh.id));
        
        // Delete orphaned webhooks
        let deletedCount = 0;
        for (const webhook of orphanedWebhooks) {
            try {
                await deleteWebhook(accessToken, baseId, webhook.id, userId);
                deletedCount++;
            } catch (error) {
                console.error(`Webhook: Error deleting orphaned webhook ${webhook.id}:`, error.message);
            }
        }
        
        return deletedCount;
    } catch (error) {
        console.error('Webhook: Error cleaning up orphaned webhooks:', error.message);
        return 0;
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
                // console.log('Refreshing access token for webhook payload fetch:', userId);
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Webhook: Error refreshing token for payload fetch:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        console.error('Webhook: Error fetching payloads:', error.response?.data || error.message);
        throw new Error('Failed to fetch webhook payloads');
    }
};






module.exports = {
    registerWebhook,
    deleteWebhook,
    fetchWebhookPayloads,
    listWebhooks,
    cleanupOrphanedWebhooks
}