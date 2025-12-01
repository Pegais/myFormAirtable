//creating axios instance for the frontend;
import axios from "axios";

const api = axios.create({
    baseURL: process.env.REACT_APP_Server_URL || 'http://localhost:5000',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

//requrest interpreter;
api.interceptors.request.use(
      (config) =>{
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

//response interpreter;handle 401;
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            //redirect to login page;
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// API functions for forms;
export const formAPI={

    //get at forms;
    getForms:()=>api.get('/api/forms'),

    //get a single form by id;
    getFormById:(formId)=>api.get(`/api/forms/${formId}`),

    //get form for public viewing;
    getFormForPublicView:(formId)=>api.get(`/api/forms/${formId}/view`),

    //create a new form;
    createForm:(formData)=>api.post('/api/forms',formData),

    //get bases;
    getBases:()=>api.get('/api/forms/bases'),

    //get tables in a base;
    getTablesInBase:(baseId)=>api.get(`/api/forms/bases/${baseId}/tables`),

    //get fields in a table;
    getFieldsInTable:(baseId,tableId)=>api.get(`/api/forms/bases/${baseId}/tables/${tableId}/fields`),

    //get form responses;
    getFormResponses:(formId)=>api.get(`/api/forms/${formId}/responses`),

    //submit form response;
    submitFormResponse:(formId,answers)=>api.post(`/api/forms/${formId}/responses`,{answers}),

    //upload file for form attachment;
    uploadFile:(formId,file)=>{
        const formData = new FormData();
        formData.append('file', file);
        // Create a separate axios instance without JSON content-type for file uploads
        return axios.post(`${process.env.REACT_APP_Server_URL || 'http://localhost:5000'}/api/forms/${formId}/upload`, formData, {
            withCredentials: true,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    //delete a form;
    deleteForm:(formId)=>api.delete(`/api/forms/${formId}`),

    //update a form;
    updateForm:(formId,formData)=>api.put(`/api/forms/${formId}`,formData),
}


export default api;