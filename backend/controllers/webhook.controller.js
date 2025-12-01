/**
 * handle Airtable webhook events;
 * POST /webhooks/airtable
 * this endpoint is used to receive webhooks from airtable when records are changed;
 */
const ResponseModel = require("../models/response.model");

const handleAirtableWebhook = async (req, res, next) => {
    try {
        console.log("=== Webhook Received ===");
        console.log("Request method:", req.method);
        console.log("Request headers:", req.headers);
        console.log("Request body:", JSON.stringify(req.body, null, 2));

        // Airtable sends a verification request when registering webhook
        // It's a GET request with a challenge parameter
        if (req.method === 'GET') {
            const challenge = req.query.challenge;
            console.log("Webhook verification request received, challenge:", challenge);
            if (challenge) {
                // Return the challenge to verify the webhook
                return res.status(200).send(challenge);
            }
        }

        // Handle webhook events (POST requests)
        const { event } = req.body;

        if (!event || !event.type) {
            console.log("Invalid webhook payload - no event or event.type");
            return res.status(400).json({ message: "Invalid webhook payload" });
        }

        const { type, record } = event;

        console.log("Webhook event type:", type);
        console.log("Webhook record ID:", record?.id);

        //check if record exists or not;
        if (!record || !record.id) {
            console.log("Webhook event missing record or record.id");
            return res.status(200).json({ message: "Webhook event missing record data" });
        }

        //find response from airtable record id;
        const response = await ResponseModel.findOne({ airtableRecordId: record.id });
        if (!response) {
            //record was not found in our database;
            // may be from different form or deleted manually;
            console.log(`Response not found for airtable record: ${record.id}`);
            return res.status(200).json({ message: "Response not found in database" });
        }

        switch (type) {
            case 'record.updated':
                //update response in our database;
                response.answers = record.fields || response.answers;
                response.updatedAt = new Date();
                await response.save();
                console.log(`✅ Response updated for airtable record: ${record.id} from Airtable webhook`);
                return res.status(200).json({ message: "Response updated successfully" });

            case 'record.deleted':
                //soft delete the response in our database;
                response.deletedInAirtable = true;
                response.updatedAt = new Date();
                await response.save();
                console.log(`✅ Response soft deleted for airtable record: ${record.id} from Airtable webhook`);
                return res.status(200).json({ message: "Response soft deleted successfully" });

            default:
                console.log(`Unsupported event type: ${type} from Airtable webhook`);
                return res.status(200).json({ message: "Unsupported event type" });
        }
    } catch (error) {
        console.error("❌ Error handling Airtable webhook:", error);
        console.error("Error stack:", error.stack);
        //always return 200 to airtable (airtable retries if we return error);
        //log the error but to avoid spamming the webhook;
        return res.status(200).json({ message: "Error handling webhook, but processed successfully" });
    }
}

module.exports = {
    handleAirtableWebhook
}