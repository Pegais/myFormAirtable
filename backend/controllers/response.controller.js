const ResponseModel = require("../models/response.model");
const FormModel = require("../models/form.model");
const { createRecordInAirtable, updateRecordInAirtable, deleteRecordInAirtable } = require("../services/airtable.service");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp and random string
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter - accept all file types (Airtable supports any file type)
const fileFilter = (req, file, cb) => {
    cb(null, true);
};

// Configure multer with limits (Airtable supports up to 5GB per file)
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 * 1024 // 5GB limit
    }
});

// Multer middleware for single file upload
const uploadSingle = upload.single('file');

/**
 * submitting a form response;
 * post/api/forms/:formId/responses
 *Body:{answers:{...}}
 */
const submitFormResponse = async (req, res, next) => {
    try {
        const formId = req.params.formId;
        const { answers } = req.body;
        const form = await FormModel.findById(formId);
        if (!form) {
            return res.status(404).json({ message: "Form not found" });
        }

        //validate check if answer object exists or is empty;
        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({ message: "Answers object is required" });
        }
        //validating required fields and asnwer types;
        const validationErrors = [];

        for (const question of form.questions) {
            const answerforQuestion = answers[question.questionKey];

            //check required fields;
            if (question.required) {
                const isEmpty = answerforQuestion === undefined || 
                               answerforQuestion === null || 
                               answerforQuestion === '' ||
                               (Array.isArray(answerforQuestion) && answerforQuestion.length === 0);
                if (isEmpty) {
                    validationErrors.push(`Question ${question.questionKey} is required`);
                    continue;
                }
            }

            //skip validation if field is not required;
            if (answerforQuestion === undefined || answerforQuestion === null || answerforQuestion === '') {
                continue;
            }

            switch (question.type) {
                case 'singleSelect':
                    if (typeof answerforQuestion !== 'string') {
                        validationErrors.push(`Question ${question.questionKey} should be a single selection`);

                    }
                    break;
                case 'multipleSelects':
                    //should be an array;
                    if (!Array.isArray(answerforQuestion)) {
                        validationErrors.push(`Question ${question.questionKey} should be a array of selections`);
                    }
                    break;
                case 'singleLineText':
                case 'multilineText':
                    if (typeof answerforQuestion !== 'string') {
                        validationErrors.push(`Question ${question.questionKey} should be a text`);

                    }
                    break;
                case 'multipleAttachments':
                    //should be array (of file urls or objects)
                    if (!Array.isArray(answerforQuestion)) {
                        validationErrors.push(`Question ${question.questionKey} should be a array of attachments`);
                    }
                    break;


            }
        }
        if (validationErrors.length > 0) {
            return res.status(400).json({ message: "Validation errors", details: validationErrors });
        }

        //Map answers to airtable field format;
        //Airtable expects:{fieldId:value,...}
        const airtableFields = {};
        for (const question of form.questions) {
            const answerValue = answers[question.questionKey];
            //only include if answer exists;
            if (answerValue !== undefined && answerValue !== null && answerValue !== '') {
                // Format attachment fields for Airtable
                if (question.type === 'multipleAttachments' && Array.isArray(answerValue)) {
                    // Airtable expects array of objects with url and filename
                    airtableFields[question.airtableFieldId] = answerValue.map(attachment => {
                        // Handle both URL strings and objects
                        if (typeof attachment === 'string') {
                            return { url: attachment, filename: path.basename(attachment) };
                        }
                        if (attachment && attachment.url) {
                            return {
                                url: attachment.url,
                                filename: attachment.filename || path.basename(attachment.url) || 'file'
                            };
                        }
                        return null;
                    }).filter(Boolean); // Remove null entries
                } else {
                    airtableFields[question.airtableFieldId] = answerValue;
                }
            }
        }

        //lets get form owners accesstoken;
        const userModel = require("../models/user.model");
        const owner = await userModel.findOne({ userId: form.userId });
        if (!owner || !owner.accessToken) {
            return res.status(500).json({ message: "Owner not found or no access token missing" });
        }
        //creating record in airtable;
        let airtableRecordId;
        try {
            airtableRecordId = await createRecordInAirtable(owner.accessToken, form.baseId, form.tableId, airtableFields,owner.userId);
        } catch (error) {
            console.error("Response: Error creating record in Airtable:", error.message);
            return res.status(500).json({ message: "Failed to create record in airtable" });
        }

        //save response to MongoDB;
        const response = await ResponseModel.create({
            formId,
            airtableRecordId,
            answers,
            deletedInAirtable: false,
        });
        res.status(201).json({ message: "Form response submitted successfully", response });
    } catch (error) {
        console.error("Response: Error submitting form response:", error.message);
        if (error.name === "ValidationError") {
            return res.status(400).json({ message: "Validation errors", details: error.message });
        }
        res.status(500).json({ message: "Failed to submit form response" });
    }
}


/**
 * get all respoonses for a from (only form owners can access this)
 * get/api/forms/:formId/responses
 */
const getFormResponses = async (req, res, next) => {
    try {
        const formId = req.params.formId;
        const userId = req.user.userId;

        //verify form belongs to the user;
        const form = await FormModel.findOne({_id:formId,userId});
        if(!form){
            return res.status(404).json({message:"Form not found"});
        }

        //get all response for this form;
        const responses = await ResponseModel.find({
            formId:formId,
            deletedInAirtable:false  //only get non-deleted responses;
        }).sort({createdAt:-1}).select('_id airtableRecordId createdAt updatedAt answers');


        //format the response with compact preview for client side;
        const formattedResponses = responses.map(response => ({
            _id:response._id,
            airtableRecordId:response.airtableRecordId,
            createdAt:response.createdAt,
            updatedAt:response.updatedAt,
            status:'submitted',
            //create compact preview of answers (first 3 questions);
            preview:Object.keys(response.answers).slice(0,3).reduce((preview,key)=>{
                const value = response.answers[key];
                preview[key] = Array.isArray(value)?`${value.length} items`:String(value).slice(0,40);
                return preview;
            },{}),
        }));
        res.status(200).json({
            message:"Form responses fetched successfully",
            responses:formattedResponses
        })
    }
    catch (error) {
        console.error("Response: Error getting form responses:", error.message);
        if(error.name === "CastError"){
            return res.status(400).json({message:"Invalid form id"});
        }
        res.status(500).json({message:"Failed to get form responses"});
    }
}

/**
 * Upload a file for form attachment
 * POST /api/forms/:formId/upload
 * Body: multipart/form-data with 'file' field
 */
const uploadFile = async (req, res, next) => {
    uploadSingle(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'File size exceeds 5GB limit' });
                }
                return res.status(400).json({ message: `Upload error: ${err.message}` });
            }
            return res.status(500).json({ message: `File upload error: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Generate public URL for the uploaded file
        const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
        const publicUrl = `${BACKEND_URL}/uploads/${req.file.filename}`;

        res.status(200).json({
            message: 'File uploaded successfully',
            file: {
                url: publicUrl,
                filename: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype
            }
        });
    });
};

module.exports = {
    submitFormResponse,
    getFormResponses,
    uploadFile,
    uploadSingle
};