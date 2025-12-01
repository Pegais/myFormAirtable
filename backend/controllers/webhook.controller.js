/**
 * handle Airtable webhook events;
 * POST /webhooks/airtable
 * this endpoint is used to receive webhooks from airtable when records are changed;
 */
const ResponseModel = require("../models/response.model");
const FormModel = require("../models/form.model");
const { fetchWebhookPayloads } = require("../services/webhook.service");
const UserModel = require("../models/user.model");

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
            console.log("✅ Webhook verification request received, challenge:", challenge);
            if (challenge) {
                // Return the challenge to verify the webhook
                return res.status(200).send(challenge);
            }
            return res.status(200).json({ message: "GET request received" });
        }

        // Handle POST requests
        const { base, webhook, timestamp, eventNotifications } = req.body;

        if (!base || !base.id || !webhook || !webhook.id) {
            console.log("⚠️ Missing base or webhook ID in request");
            return res.status(400).json({ message: "Missing base or webhook ID" });
        }

        const baseId = base.id;
        const webhookId = webhook.id;

        console.log(`📡 Webhook notification received:`);
        console.log(`   Base: ${baseId}`);
        console.log(`   Webhook: ${webhookId}`);
        console.log(`   Timestamp: ${timestamp}`);
        console.log(`   Event notifications: ${eventNotifications?.length || 0}`);

        // Find the form associated with this webhook
        const form = await FormModel.findOne({ webhookId: webhookId });
        if (!form) {
            console.log(`⚠️ Form not found for webhook: ${webhookId}`);
            // Still return 200 to avoid Airtable retries
            return res.status(200).json({ message: "Form not found, but webhook acknowledged" });
        }

        // Get the user's access token for fetching payloads
        const user = await UserModel.findOne({ userId: form.userId });
        if (!user || !user.accessToken) {
            console.log(`⚠️ User or access token not found for form: ${form._id}`);
            return res.status(200).json({ message: "User not found, but webhook acknowledged" });
        }

        console.log(`✅ Found form and user. Fetching webhook payloads...`);

        // Fetch the actual payloads from Airtable
        // When cursor is null, Airtable returns the latest available payloads
        let payloads;
        try {
            payloads = await fetchWebhookPayloads(
                user.accessToken,
                baseId,
                webhookId,
                null, // cursor - null means fetch latest
                user.userId
            );
            console.log(`📦 Fetched webhook payloads:`, JSON.stringify(payloads, null, 2));
        } catch (error) {
            console.error(`❌ Error fetching webhook payloads:`, error.message);
            // Still return 200 to avoid Airtable retries
            return res.status(200).json({ message: "Error fetching payloads, but webhook acknowledged" });
        }

        // Check if we have payloads with events
        if (!payloads || !payloads.payloads || payloads.payloads.length === 0) {
            console.log("✅ Webhook ping/heartbeat - no payloads available (webhook is healthy)");
            return res.status(200).json({ message: "Webhook ping received - no payloads" });
        }

        console.log(`📬 Processing ${payloads.payloads.length} payload(s)`);

        // Process each payload
        for (let i = 0; i < payloads.payloads.length; i++) {
            const payload = payloads.payloads[i];
            console.log(`\n📋 Processing payload ${i + 1}/${payloads.payloads.length}:`);
            console.log(`   Payload timestamp: ${payload.timestamp}`);
            console.log(`   Event notifications: ${payload.eventNotifications?.length || 0}`);

            if (!payload.eventNotifications || !Array.isArray(payload.eventNotifications) || payload.eventNotifications.length === 0) {
                console.log("   ⚠️ No event notifications in this payload");
                continue;
            }

            // Process each event notification in the payload
            for (const notification of payload.eventNotifications) {
                const { event } = notification;

                if (!event || !event.type) {
                    console.log("   ⚠️ Invalid event notification - missing event or event.type");
                    continue;
                }

                const { type, record } = event;

                console.log(`   🔔 Event type: ${type}`);
                console.log(`   📝 Record ID: ${record?.id}`);

                // Check if record exists
                if (!record || !record.id) {
                    console.log("   ⚠️ Event missing record or record.id, skipping");
                    continue;
                }

                // Find response from airtable record id
                const response = await ResponseModel.findOne({ airtableRecordId: record.id });
                if (!response) {
                    console.log(`   ⚠️ Response not found for airtable record: ${record.id}`);
                    console.log(`      This record exists in Airtable but not in MongoDB.`);
                    continue;
                }

                console.log(`   ✅ Found matching response in MongoDB`);

                switch (type) {
                    case 'record.updated':
                        // Update response in our database
                        const oldAnswers = JSON.stringify(response.answers);
                        response.answers = record.fields || response.answers;
                        response.updatedAt = new Date();
                        await response.save();
                        console.log(`   ✅ Response updated for airtable record: ${record.id}`);
                        console.log(`      Old: ${oldAnswers}`);
                        console.log(`      New: ${JSON.stringify(response.answers)}`);
                        break;

                    case 'record.deleted':
                        // Soft delete the response in our database
                        response.deletedInAirtable = true;
                        response.updatedAt = new Date();
                        await response.save();
                        console.log(`   ✅ Response soft deleted for airtable record: ${record.id}`);
                        break;

                    case 'record.created':
                        console.log(`   ℹ️ Record created event: ${record.id} (already in MongoDB)`);
                        break;

                    default:
                        console.log(`   ⚠️ Unsupported event type: ${type}`);
                        break;
                }
            }
        }

        // Always return 200 OK to Airtable
        return res.status(200).json({ message: "Webhook processed successfully" });

    } catch (error) {
        console.error("❌ Error handling Airtable webhook:", error);
        console.error("Error stack:", error.stack);
        // Always return 200 to airtable (airtable retries if we return error)
        return res.status(200).json({ message: "Error handling webhook, but processed successfully" });
    }
}

module.exports = {
    handleAirtableWebhook
}