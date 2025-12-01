const axios = require('axios');
const{refreshAccessToken}=require('./tokenRefreshService');

//Airtable centralized serive , handles all api related to airtable interactions;
/**
 * getting all bases accessible to user from airtable;
 * @param {string} accessToken - the access token for the user;
 * @returns {Promise<Array<Object>>} - list of bases accessible to user;
 */

const getAccessibleUserBases = async (accessToken,userId=null) => {
    const makeRequest=async(accessToken)=>{
        const response = await axios.get('https://api.airtable.com/v0/meta/bases', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });  
        return response.data.bases || [];
    }
    try { 
        return await makeRequest(accessToken);
    } catch (error) {
        //if 401, and userId is provided, try to refresh token;
        if(error.response?.status === 401 && userId){
            try {
                // console.log('Refreshing access token for user:', userId);
                
                const newAccessToken = await refreshAccessToken(userId);
                return await makeRequest(newAccessToken);
            } catch (refreshError) {
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        console.error('Airtable: Error getting accessible user bases:', error.response?.data || error.message);
        throw new Error('Failed to fetch accessible airtable bases');
    }
};


/**
 * getting all tables in a specific base from airtable;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to get tables from;
 * @returns {Promise<Array<Object>>} - list of tables in the base;
 */
const getTablesInBase = async (accessToken, baseId, userId=null) => {
    const makeRequest=async(token)=>{
        const response = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        return response.data.tables || [];
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
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Airtable: Error getting tables in base:', error.response?.data || error.message);
        throw new Error('Failed to fetch tables from airtable base');
    }
};


/**
 * getting all fields in a specific table from airtable;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to get tables from;
 * @param {string} tableId - the id of the table to get fields from;
 * @returns {Promise<Array<Object>>} - list of fields in the table;     
 */
const getFieldsInTable = async (accessToken, baseId, tableId,userId=null) => {
    const makeRequest=async(token)=>{
         //fetching all the tables from airfield;
         const response = await axios.get(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        //find specific table from the list of tables;
        const allTable =response.data.tables || [];
        const table = allTable.find(table => table.id === tableId);
        if(!table){
            throw new Error(`table with id ${tableId} not found in base ${baseId}`);
        }
        const allfields = table.fields || [];

        //filtering out only supported field types;
        const supportedFields = allfields.filter(field => ['singleLineText', 'multilineText', 'singleSelect', 'multipleSelects', 'multipleAttachments'].includes(field.type));
        return supportedFields;
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
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Airtable: Error getting fields in table:', error.response?.data || error.message);
        throw new Error('Failed to fetch fields from airtable table');
    }
};

/**
 * validate if a field is supported by airtable;
 * @param {Object} field - airtable field object;
 * @returns {boolean} - true if the field is supported, false otherwise;
 */
const isFieldSupported = (field) => {
    const supportedTypes = ['singleLineText', 'multilineText', 'singleSelect', 'multipleSelects', 'multipleAttachments'];
    return supportedTypes.includes(field.type);
}
/**
 * create a new record in airtable;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to create the record in;
 * @param {string} tableId - the id of the table to create the record in;
 * @param {Object} fields - field value to insert {fieldId:value,...};
 * @returns {Promise<Object>} - the created record;
 */
const createRecordInAirtable = async (accessToken, baseId, tableId, fields, userId=null) => {
    const makeRequest=async(token)=>{
        // Log fields being sent to Airtable for debugging
        console.error('Airtable: Creating record with fields:', JSON.stringify(fields, null, 2));
        
        const response = await axios.post(`https://api.airtable.com/v0/${baseId}/${tableId}`, {
            fields: fields
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.id;//record id ;
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
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }
        // Log detailed error response from Airtable
        console.error('Airtable: Error creating record - Status:', error.response?.status);
        console.error('Airtable: Error response data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Airtable: Error message:', error.message);
        throw new Error('Failed to create record in airtable');
    }
}


/**update an existing record in airtable;
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to update the record in;
 * @param {string} tableId - the id of the table to update the record in;
 * @param {string} recordId - the id of the record to update;
 * @param {Object} fields - field value to update {fieldId:value,...};
 * @returns {Promise<Object>} - the updated record;
 */
const updateRecordInAirtable = async (accessToken, baseId, tableId, recordId, fields, userId=null) => {
    const makeRequest=async(token)=>{
        const response = await axios.patch(`https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`, {
            fields: fields
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data;
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
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Airtable: Error updating record:', error.response?.data || error.message);
        throw new Error('Failed to update record in airtable');
    }
}

/**
 * delete a record in airtable;(soft delete only : flag in our DB   )
 * @param {string} accessToken - the access token for the user;
 * @param {string} baseId - the id of the base to delete the record in;
 * @param {string} tableId - the id of the table to delete the record in;
 * @param {string} recordId - the id of the record to delete;
 * @returns {Promise<Object>} - the deleted record;
 */
const deleteRecordInAirtable = async (accessToken, baseId, tableId, recordId, userId=null) => {
    const makeRequest=async(token)=>{
        await axios.delete(`https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }

        );
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
                console.error('Airtable: Error refreshing access token:', refreshError.response?.data || refreshError.message);
                throw new Error('Failed to refresh access token');
            }
        }   
        console.error('Airtable: Error deleting record:', error.response?.data || error.message);
        throw new Error('Failed to delete record in airtable');
    }

}


module.exports = {
    getAccessibleUserBases,
    getTablesInBase,
    getFieldsInTable,
    isFieldSupported,
    createRecordInAirtable,
    updateRecordInAirtable,
    deleteRecordInAirtable
};