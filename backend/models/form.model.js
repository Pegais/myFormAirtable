const mongoose = require("mongoose");

const formSchema = new mongoose.Schema({
    //creator of the form;
    userId: {
        type: String,
        required: true
    },
    //name or title of the form;
    formName: {
        type: String,
        required: true
    },
    //which airtable base this form is connecting to;
    baseId: {
        type: String,
        required: true
    },
    //which airtable table in the base
    tableId: {
        type: String,
        required: true
    },
    webhookId:{
        type:String,
        default:null
    },
    questions: [
        {
            //creating internal identifier for condtitonal logic
            questionKey: {
                type: String,
                required: true
            },
            //airtable field id this question is connected to
            airtableFieldId: {
                type: String,
                required: true
            },
            //label for the question
            label: {
                type: String,
                required: true
            },
            type: {
                type: String,
                required: true,
                enum: ['singleLineText', 'multilineText', 'singleSelect', 'multipleSelects', 'multipleAttachments']
            },
            //adding this field to capture options from airtable;
            options:{
                type: [mongoose.Schema.Types.Mixed],
                default: undefined,
            },
            //is this field is required
            required: {
                type: Boolean,
                default: false
            },
            //conditional logic rules;
            conditionalLogicRules: {
                logic: {
                    type: String,
                    enum: ['AND', 'OR'],
                    default: 'AND'
                },
                conditions: [{
                    questionKey: String,//which question we are checking against
                    operator: {
                        type: String,
                        enum: ['equals', 'doesNotEqual', 'contains']
                    },
                    value: mongoose.Schema.Types.Mixed //the value to compare against
                }]
            }

        }

    ],
    createdAt:{
        type:Date,
        default:Date.now
    },
    updatedAt:{
        type:Date,
        default:Date.now
    }
 
});

//updating the updatedAt field before saving;
formSchema.pre('save',async function(){
    this.updatedAt = Date.now();
   
});

module.exports = mongoose.model('Form',formSchema);