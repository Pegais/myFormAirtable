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

        // Handle POST requests
        const { base, webhook, timestamp, eventNotifications } = req.body;

        // Check if this is a ping/heartbeat request (no eventNotifications)
        // Airtable sends these periodically to verify the webhook is still alive
        if (!eventNotifications || !Array.isArray(eventNotifications) || eventNotifications.length === 0) {
            console.log("✅ Webhook ping/heartbeat received - webhook is healthy");
            console.log(`   Base: ${base?.id}, Webhook: ${webhook?.id}, Timestamp: ${timestamp}`);
            // Return 200 OK for ping requests
            return res.status(200).json({ message: "Webhook ping received" });
        }

        // Process event notifications
        console.log(`📬 Received ${eventNotifications.length} event notification(s)`);

        for (const notification of eventNotifications) {
            const { event } = notification;

            if (!event || !event.type) {
                console.log("⚠️ Skipping invalid event notification - missing event or event.type");
                continue;
            }

            const { type, record } = event;

            console.log(`📋 Processing event: ${type}, Record ID: ${record?.id}`);

            // Check if record exists
            if (!record || !record.id) {
                console.log("⚠️ Event missing record or record.id, skipping");
                continue;
            }

            // Find response from airtable record id
            const response = await ResponseModel.findOne({ airtableRecordId: record.id });
            if (!response) {
                // Record was not found in our database
                // May be from different form or deleted manually
                console.log(`⚠️ Response not found for airtable record: ${record.id}`);
                continue;
            }

            switch (type) {
                case 'record.updated':
                    // Update response in our database
                    response.answers = record.fields || response.answers;
                    response.updatedAt = new Date();
                    await response.save();
                    console.log(`✅ Response updated for airtable record: ${record.id}`);
                    break;

                case 'record.deleted':
                    // Soft delete the response in our database
                    response.deletedInAirtable = true;
                    response.updatedAt = new Date();
                    await response.save();
                    console.log(`✅ Response soft deleted for airtable record: ${record.id}`);
                    break;

                default:
                    console.log(`⚠️ Unsupported event type: ${type}`);
                    break;
            }
        }

        // Always return 200 OK to Airtable (Airtable retries if we return error)
        return res.status(200).json({ message: "Webhook processed successfully" });

    } catch (error) {
        console.error("❌ Error handling Airtable webhook:", error);
        console.error("Error stack:", error.stack);
        // Always return 200 to airtable (airtable retries if we return error)
        // Log the error but avoid spamming the webhook
        return res.status(200).json({ message: "Error handling webhook, but processed successfully" });
    }
}

module.exports = {
    handleAirtableWebhook
}