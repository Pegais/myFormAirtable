const formModel = require("../models/form.model");
const FormModel = require("../models/form.model");
const { getAccessibleUserBases,
    getTablesInBase,
    getFieldsInTable,
    isFieldSupported,
    createRecordInAirtable,
    updateRecordInAirtable,
    deleteRecordInAirtable } = require("../services/airtable.service");
const { registerWebhook, deleteWebhook } = require("../services/webhook.service");

/**
 * get all airtable bases for the authenticated user;
 * get/api/forms/bases
 */
const getBases = async (req, res, next) => {
    try {
        const accessToken = req.user.accessToken;
        const userId = req.user.userId;
        const bases = await getAccessibleUserBases(accessToken, userId);
        res.status(200).json({ bases });
    } catch (error) {
        console.error("Forms: Error getting airtable bases:", error.message);
        return res.status(500).json({ message: "Failed to get airtable bases" });

    }
};

/**
 * get all tables in a specific base;
 * get/api/forms/bases/:baseId/tables
 */
const getTables = async (req, res, next) => {
    try {
        const accessToken = req.user.accessToken;
        const userId = req.user.userId;
        const baseId = req.params.baseId;
        const tables = await getTablesInBase(accessToken, baseId, userId);
        res.status(200).json({ tables });
    } catch (error) {
        console.error("Forms: Error getting airtable tables:", error.message);
        return res.status(500).json({ message: "Failed to get airtable tables" });

    }
};

/**
 * get all fields in a specific table;
 * get/api/forms/bases/:baseId/tables/:tableId/fields
 */
const getFields = async (req, res, next) => {
    try {
        const accessToken = req.user.accessToken;
        const userId = req.user.userId;
        const baseId = req.params.baseId;
        const tableId = req.params.tableId;
        if (!baseId || !tableId) {
            return res.status(400).json({ error: "baseId and tableId are required" });
        }
        const fields = await getFieldsInTable(accessToken, baseId, tableId, userId);
        res.status(200).json({ fields });
    } catch (error) {
        console.error("Forms: Error getting airtable fields:", error.message);
        return res.status(500).json({ message: "Failed to get airtable fields" });
    }
};

/**
 * create a new form;
 * post/api/forms
 *Body:{formName:string,baseId:string,tableId:string,questions:[...]}
 */
const createForm = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { formName, baseId, tableId, questions } = req.body;
        //validation;
        if (!formName || !baseId || !tableId || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ error: "Missing required fields: formName, baseId, tableId, questions" });
        }
        if (questions.length === 0) {
            return res.status(400).json({ error: "should have at least one question" });
        }
        //validating questions array;
        for (const question of questions) {
            if (!question.questionKey || !question.airtableFieldId || !question.label || !question.type) {
                return res.status(400).json({ error: "Each question must have a questionKey, airtableFieldId, label, and type" });
            };
        }

        //creating the form in our database;
        const form = await FormModel.create({ userId, formName, baseId, tableId, questions });
        try {
            //registering webhook with airtable;
            const UserModel = require("../models/user.model");
            const owner = await UserModel.findOne({ userId });
            if (owner && owner.accessToken) {
                const webhookUrl = `${process.env.BACKEND_URL}/webhooks/airtable`;
                if (webhookUrl.startsWith('http://')) {
                    console.warn('⚠️  WARNING: Webhook URL uses HTTP. Airtable requires HTTPS.');
                    console.warn('   For local development, use ngrok or similar tool to create HTTPS tunnel.');
                    console.warn('   Skipping webhook registration. Form will be created without webhook.');
                    console.warn(`   Local webhook URL would be: ${webhookUrl}`);

                } else {
                    //url is https, so we can register the webhook;
                    const webhookId = await registerWebhook(owner.accessToken, baseId, tableId, webhookUrl, userId);
                    form.webhookId = webhookId;
                    await form.save();
                    // console.log(`Webhook ${webhookId} registered successfully`);
                }
            }
            res.status(201).json({ form });
        } catch (webhookError) {
            console.error("Forms: Error registering webhook:", webhookError.message);
            //continue with form creation even if webhook fails;
            await form.save();
            res.status(201).json({ form });

        }
    } catch (error) {
        console.error("Forms: Error creating form:", error.message);
        if (error.name === "ValidationError") {
            return res.status(400).json({ error: error.message });
        };
        //we cant fails  forms creation due to webhook;
        res.status(200).json({ message: "Failed to create form" });

    }
}


/**
 * get all forms for the authenticated user;
 * get/api/forms
 */
const getForms = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const forms = await FormModel.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json({ forms });
    } catch (error) {
        console.error("Forms: Error getting forms:", error.message);
        return res.status(500).json({ message: "Failed to get forms" });
    }
};


/**
 * get a single form by id ;(only if it is owned by the authenticated user)
 * get/api/forms/:formId
 */
const getFormById = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const formId = req.params.formId;
        const form = await FormModel.findOne({ _id: formId, userId });
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        };
        res.status(200).json({ form });
    } catch (error) {
        console.error("Forms: Error getting form:", error.message);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid form id" });
        };
        res.status(500).json({ message: "Failed to get form" });
    }
};

/**
 * get forms for public viewing no authentication required;
 * get/api/forms/:formId/view
 */
const getFormForPublicView = async (req, res, next) => {
    try {
        const formId = req.params.formId;
        const form = await FormModel.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        };
        res.status(200).json({ form });
    } catch (error) {
        console.error("Forms: Error getting form for public view:", error.message);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid form id" });
        };
        res.status(500).json({ message: "Failed to get form for public view" });
    }


};

/**
 * delete a form (only if it is owned by the authenticated user)
 * delete/api/forms/:formId
 */
const deleteForm = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const formId = req.params.formId;
        const form = await FormModel.findOne({ _id: formId, userId });
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        };
        //delete the webhook from airtable if exists;
        if (form.webhookId) {
            try {
                const UserModel = require("../models/user.model");
                const owner = await UserModel.findOne({ userId });
                if (owner && owner.accessToken) {
                    await deleteWebhook(owner.accessToken, form.baseId, form.webhookId, userId);
                }
            } catch (webhookError) {
                console.error("Forms: Error deleting webhook:", webhookError.message);
                console.warn('Webhook deletion failed, continuing with other operations');
                //continue with form deletion even if webhook deletion fails;
            }
        }
        //deleting the form from our database;
        await formModel.findByIdAndDelete(formId);
        res.status(200).json({ message: "Form deleted successfully" });
    }
    catch (error) {
        console.error("Forms: Error deleting form:", error.message);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid form id" });
        };
        res.status(500).json({ message: "Failed to delete form" });
    }
}

/**
 * update a form (only if it is owned by the authenticated user)
 * put/api/forms/:formId
 * Body:{formName:string,baseId:string,tableId:string,questions:[...]}
 */
const updateForm = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const formId = req.params.formId;
        const { formName, questions } = req.body;

        //find form and verify ownership;
        const form = await FormModel.findOne({ _id: formId, userId });
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }
        if (formName !== undefined) {
            form.formName = formName;
        }
        if (questions !== undefined && !Array.isArray(questions)) {
            return res.status(400).json({ message: "Questions must be an array" });
        }
        if (questions !== undefined && questions.length === 0) {
            return res.status(400).json({ message: "should have at least one question" });
        }
        //validating questions array;
        if (questions !== undefined) {
            for (const question of questions) {
                if (!question.questionKey || !question.airtableFieldId || !question.label || !question.type) {
                    return res.status(400).json({ error: "Each question must have a questionKey, airtableFieldId, label, and type" });
                }
            }

            form.questions = questions;
        }
        await form.save();
        res.status(200).json({ message: "Form updated successfully", form });
    }
    catch (error) {
        console.error("Forms: Error updating form:", error.message);
        if (error.name === "CastError") {
            return res.status(400).json({ message: "Invalid form id" });
        };
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: error.message });
        };
        res.status(500).json({ message: "Failed to update form" });
    }
}

module.exports = {
    updateForm,
    deleteForm,
    getBases,
    getTables,
    getFields,
    createForm,
    getForms,
    getFormById,
    getFormForPublicView
};