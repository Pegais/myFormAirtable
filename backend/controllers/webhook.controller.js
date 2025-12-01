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
        // console.log("=== Webhook Received ===");
        // console.log("Request method:", req.method);
        // console.log("Request headers:", req.headers);
        // console.log("Request body:", JSON.stringify(req.body, null, 2));

        // Airtable sends a verification request when registering webhook
        // It's a GET request with a challenge parameter
        if (req.method === 'GET') {
            const challenge = req.query.challenge;
            // console.log("Webhook verification request received, challenge:", challenge);
            if (challenge) {
                // Return the challenge to verify the webhook
                return res.status(200).send(challenge);
            }
            return res.status(200).json({ message: "GET request received" });
        }

        // Handle POST requests
        const { base, webhook, timestamp, eventNotifications } = req.body;

        // Log the incoming webhook request body
        console.log(`Webhook: Incoming request body:`, JSON.stringify(req.body, null, 2));

        if (!base || !base.id || !webhook || !webhook.id) {
            console.error("Webhook: Missing base or webhook ID in request");
            return res.status(400).json({ message: "Missing base or webhook ID" });
        }

        const baseId = base.id;
        const webhookId = webhook.id;

        console.log(`Webhook notification received:`);
        console.log(`Base: ${baseId}`);
        console.log(`Webhook: ${webhookId}`);
        console.log(`Timestamp: ${timestamp}`);
        console.log(`Event notifications in request: ${eventNotifications?.length || 0}`);

        // Find the form associated with this webhook
        const form = await FormModel.findOne({ webhookId: webhookId });
        if (!form) {
            console.error(`Webhook: Form not found for webhook: ${webhookId}`);
            // Still return 200 to avoid Airtable retries
            return res.status(200).json({ message: "Form not found, but webhook acknowledged" });
        }

        // Get the user's access token for fetching payloads
        const user = await UserModel.findOne({ userId: form.userId });
        if (!user || !user.accessToken) {
            console.error(`Webhook: User or access token not found for form: ${form._id}`);
            return res.status(200).json({ message: "User not found, but webhook acknowledged" });
        }

        // console.log(`Found form and user. Fetching webhook payloads...`);

        // Fetch all available payloads from Airtable (handle pagination)
        // Track processing statistics
        let stats = {
            totalPayloads: 0,
            totalEvents: 0,
            processed: 0,
            notFound: 0,
            errors: 0,
            skipped: 0
        };

        // Fetch all payloads using cursor pagination
        // Airtable webhook payloads can be paginated, so we need to fetch all available payloads
        let allPayloads = [];
        let cursor = null;
        let hasMore = true;
        const MAX_ITERATIONS = 100; // Safety limit to prevent infinite loops
        let iterations = 0;

        while (hasMore && iterations < MAX_ITERATIONS) {
            iterations++;
            try {
                const payloadResponse = await fetchWebhookPayloads(
                    user.accessToken,
                    baseId,
                    webhookId,
                    cursor,
                    user.userId
                );

                // Log payload response structure (first iteration only)
                if (iterations === 1) {
                    console.log(`Webhook: Payload response structure:`, JSON.stringify({
                        hasPayloads: !!payloadResponse?.payloads,
                        payloadsCount: payloadResponse?.payloads?.length || 0,
                        hasCursor: !!payloadResponse?.cursor,
                        mightHaveMore: payloadResponse?.mightHaveMore,
                        hasMore: payloadResponse?.hasMore,
                        responseKeys: payloadResponse ? Object.keys(payloadResponse) : []
                    }, null, 2));
                    // Log full payload response for first fetch to see complete structure
                    console.log(`Webhook: Full payload response:`, JSON.stringify(payloadResponse, null, 2));
                }

                if (!payloadResponse) {
                    break;
                }

                // Airtable returns payloads in the response
                const payloads = payloadResponse.payloads || [];
                if (payloads.length === 0) {
                    break;
                }

                // Log first payload structure for debugging
                if (allPayloads.length === 0 && payloads.length > 0) {
                    console.log(`Webhook: Sample payload structure:`, JSON.stringify({
                        payloadKeys: Object.keys(payloads[0]),
                        timestamp: payloads[0].timestamp,
                        eventNotificationsCount: payloads[0].eventNotifications?.length || 0,
                        firstEventType: payloads[0].eventNotifications?.[0]?.event?.type,
                        firstRecordId: payloads[0].eventNotifications?.[0]?.event?.record?.id
                    }, null, 2));
                    // Log full first payload to see complete structure
                    console.log(`Webhook: Full first payload:`, JSON.stringify(payloads[0], null, 2));
                }

                allPayloads = allPayloads.concat(payloads);
                stats.totalPayloads = allPayloads.length;

                // Check if there are more payloads to fetch
                // Airtable uses 'cursor' for pagination and 'mightHaveMore' flag
                cursor = payloadResponse.cursor || null;
                hasMore = (payloadResponse.mightHaveMore === true || payloadResponse.hasMore === true) && cursor !== null;
            } catch (error) {
                console.error(`Webhook: Error fetching payloads (cursor: ${cursor}):`, error.message);
                // Break on error but continue processing what we have
                hasMore = false;
            }
        }

        if (iterations >= MAX_ITERATIONS) {
            console.error(`Webhook: Reached maximum pagination iterations (${MAX_ITERATIONS}). Stopping pagination.`);
        }

        // Check if we have any payloads to process
        if (allPayloads.length === 0) {
            // console.log("Webhook ping/heartbeat - no payloads available (webhook is healthy)");
            return res.status(200).json({ message: "Webhook ping received - no payloads" });
        }

        console.log(`Webhook: Processing ${allPayloads.length} payload(s)`);

        // Process each payload
        for (let i = 0; i < allPayloads.length; i++) {
            const payload = allPayloads[i];
            // console.log(`Processing payload ${i + 1}/${allPayloads.length}:`);
            // console.log(`Payload timestamp: ${payload.timestamp}`);

            if (!payload.eventNotifications || !Array.isArray(payload.eventNotifications) || payload.eventNotifications.length === 0) {
                // console.log("No event notifications in this payload");
                continue;
            }

            stats.totalEvents += payload.eventNotifications.length;

            // Process each event notification in the payload
            for (const notification of payload.eventNotifications) {
                try {
                    // Log notification structure for debugging (first event only)
                    if (stats.totalEvents === 1) {
                        console.log(`Webhook: Sample event notification structure:`, JSON.stringify({
                            notificationKeys: Object.keys(notification),
                            hasEvent: !!notification.event,
                            eventType: notification.event?.type,
                            recordId: notification.event?.record?.id,
                            recordFieldsCount: notification.event?.record?.fields ? Object.keys(notification.event.record.fields).length : 0
                        }, null, 2));
                        // Log full first event notification to see complete structure
                        console.log(`Webhook: Full first event notification:`, JSON.stringify(notification, null, 2));
                    }

                    const { event } = notification;

                    if (!event || !event.type) {
                        stats.skipped++;
                        console.log(`Webhook: Invalid event notification - missing event or event.type. Notification:`, JSON.stringify(notification, null, 2));
                        continue;
                    }

                    const { type, record } = event;

                    // Check if record exists in event
                    if (!record || !record.id) {
                        stats.skipped++;
                        console.log(`Webhook: Event missing record or record.id. Event type: ${type}, Event structure:`, JSON.stringify(event, null, 2));
                        continue;
                    }

                    // Find response from airtable record id
                    // Handle case where record might not exist in MongoDB (deleted, etc.)
                    const response = await ResponseModel.findOne({ airtableRecordId: record.id });

                    if (!response) {
                        stats.notFound++;
                        // Record doesn't exist in MongoDB - this is OK, just skip it
                        // This can happen if:
                        // - Record was created directly in Airtable (not via form)
                        // - Record was deleted from MongoDB but still exists in Airtable
                        // - Record belongs to a different form
                        // console.log(`Response not found for airtable record: ${record.id} (skipping)`);
                        continue;
                    }

                    // Process the event based on type
                    switch (type) {
                        case 'record.updated':
                            try {
                                // Update response in our database
                                response.answers = record.fields || response.answers;
                                response.updatedAt = new Date();
                                await response.save();
                                stats.processed++;
                                console.log(`Webhook: Response updated for record ${record.id}`);
                            } catch (updateError) {
                                stats.errors++;
                                console.error(`Webhook: Error updating record ${record.id}:`, updateError.message);
                                // Continue processing other records even if this one fails
                            }
                            break;

                        case 'record.deleted':
                            try {
                                // Soft delete the response in our database
                                response.deletedInAirtable = true;
                                response.updatedAt = new Date();
                                await response.save();
                                stats.processed++;
                                console.log(`Webhook: Response soft deleted for record ${record.id}`);
                            } catch (deleteError) {
                                stats.errors++;
                                console.error(`Webhook: Error soft-deleting record ${record.id}:`, deleteError.message);
                                // Continue processing other records even if this one fails
                            }
                            break;

                        case 'record.created':
                            // Record already exists in MongoDB (created via form submission)
                            // This event might come if record was recreated in Airtable
                            stats.skipped++;
                            // console.log(`Record created event: ${record.id} (already in MongoDB)`);
                            break;

                        default:
                            stats.skipped++;
                            // console.log(`Unsupported event type: ${type}`);
                            break;
                    }
                } catch (eventError) {
                    // Catch any errors in processing individual events
                    stats.errors++;
                    console.error(`Webhook: Error processing event:`, eventError.message);
                    // Continue with next event
                }
            }
        }

        // Log summary statistics
        console.log(`Webhook: Processing summary - Processed: ${stats.processed}, Not Found: ${stats.notFound}, Errors: ${stats.errors}, Skipped: ${stats.skipped}`);

        // Always return 200 OK to Airtable
        return res.status(200).json({ message: "Webhook processed successfully" });

    } catch (error) {
        console.error("Webhook: Error handling webhook:", error.message);
        // console.error("Error stack:", error.stack);
        // Always return 200 to airtable (airtable retries if we return error)
        return res.status(200).json({ message: "Error handling webhook, but processed successfully" });
    }
}

module.exports = {
    handleAirtableWebhook
}