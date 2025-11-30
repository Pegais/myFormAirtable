const mongoose = require("mongoose");
const responseSchema = new mongoose.Schema({
    //which form this response is for;
    formId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Form',
        required:true,
        index:true, //indexing for faster lookups
        
    },
    //airtable record id after we create the record;
    airtableRecordId:{
        type:String,
        required:true,
        index:true, //indexing for faster lookups
    },
    //the actual answrs being submitted by the user;
    answers:{
        type:mongoose.Schema.Types.Mixed,
        required:true,
    },
    //creating a flag to track whtehr the record was deleted in airtable via webhook;
    deletedInAirtable:{
        type:Boolean,
        default:false,
        index:true, //indexing for faster lookups
    },
    //timestamp of when the response was created;
    createdAt:{
        type:Date,
        default:Date.now
    },
    //timestamp of when the response was last updated;
    updatedAt:{
        type:Date,
        default:Date.now
    }
});

//updating the updatedAt field before saving;
responseSchema.pre('save', async function(){
    this.updatedAt = Date.now();

});

module.exports = mongoose.model('Response',responseSchema);