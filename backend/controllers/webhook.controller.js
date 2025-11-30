/**
 * handle Airtable webhook events;
 * POST /webhooks/airtable
 * this endpoint is used ti recieve webhooks from airtable when records are changed;
 */
const ResponseModel = require("../models/response.model");

const handleAirtableWebhook = async (req, res, next) => {
    try {
        //Airtable sends a webhhook payload;
        const {event}=req.body;
        //Airtable webhook structure:
        //{event:{type:'record.updated' | 'record.deleted}}

        if(!event || !event.type){
            return res.status(400).json({message:"Invalid webhook payload"});
        }
        const {type,record}=event;
        //check if record exists or not;
        if(!record || !record.id){
            console.log("Webhooke event is missing the record or record id ...");
            return res.status(200).json({message:"Webhook event is missing the record or record id ..."});
        }

        //find response from airtable record id;
        const response = await ResponseModel.findOne({airtableRecordId:record.id});
        if(!response){
            //record  was not found in our databse;
            // may be from different form or deleted manually;
            console.log(`Response not found for airtable record: ${record.id}`);
            return res.status(200).json({message:"Response not found in database"});
        }
       
        switch(type){
            case 'record.updated':
                //update response in our database;
                response.answers=record.fields || response.answers;
                response.updatedAt=new Date();
                await response.save();
                console.log(`Response updated for airtable record: ${record.id} from Airtable webhook`);
                return res.status(200).json({message:"Response updated successfully"});
                
            case 'record.deleted':
                //soft delete the response in our database;
                response.deletedInAirtable=true;
                response.updatedAt=new Date();
                await response.save();
                console.log(`Response soft deleted for airtable record: ${record.id} from Airtable webhook`);
                return res.status(200).json({message:"Response soft deleted successfully"});
            default:
                console.log(`Unsupported event type: ${type} from Airtable webhook`);
                return res.status(200).json({message:"Unsupported event type"});
        }
    } catch (error) {
        console.error("Error handling Airtable webhook:",error);
        //always return 200 to airtable (airtable retries if we return error);
        //log the error but to avoid spamming the webhook;
        return res.status(200).json({message:"Error handling webhook, but processed successfully"});
        
        
    }
}

module.exports = {
    handleAirtableWebhook
}