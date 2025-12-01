/**
 * handle Airtable webhook events;
 * POST /webhooks/airtable
 * this endpoint is used to receive webhooks from airtable when records are changed;
 */
const ResponseModel = require("../models/response.model");
const FormModel = require("../models/form.model");
const { fetchWebhookPayloads } = require("../services/webhook.service");
const UserModel = require("../models/user.model");

/**
 * Map Airtable cellValuesByFieldId to our answers format using form questions
 * @param {Object} cellValuesByFieldId - Airtable field values keyed by field ID
 * @param {Array} questions - Form questions array with airtableFieldId mappings
 * @returns {Object} - Answers object keyed by questionKey
 */
const mapCellValuesToAnswers = (cellValuesByFieldId, questions) => {
    const answers = {};

    // Create a map of airtableFieldId to questionKey for quick lookup
    const fieldIdToQuestionKey = {};
    questions.forEach(q => {
        fieldIdToQuestionKey[q.airtableFieldId] = q.questionKey;
    });

    // Map each cell value to its question key
    for (const [fieldId, value] of Object.entries(cellValuesByFieldId)) {
        const questionKey = fieldIdToQuestionKey[fieldId];
        if (questionKey) {
            // Handle different value types from Airtable
            if (value && typeof value === 'object' && value.id) {
                // Single select option object: { id: "...", name: "...", color: "..." }
                answers[questionKey] = value.name || value.id;
            } else if (Array.isArray(value)) {
                // Multiple selects or attachments: array of objects or values
                answers[questionKey] = value.map(v => {
                    if (v && typeof v === 'object' && v.name) {
                        return v.name;
                    }
                    return v;
                });
            } else if (value !== null && value !== undefined) {
                // Simple value (text, number, etc.) - skip null/undefined
                answers[questionKey] = value;
            }
        }
    }

    return answers;
};

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
        const { base, webhook, timestamp } = req.body;

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
                    const firstPayload = payloads[0];
                    const tableIds = firstPayload.changedTablesById ? Object.keys(firstPayload.changedTablesById) : [];
                    console.log(`Webhook: Sample payload structure:`, JSON.stringify({
                        payloadKeys: Object.keys(firstPayload),
                        timestamp: firstPayload.timestamp,
                        baseTransactionNumber: firstPayload.baseTransactionNumber,
                        changedTablesCount: tableIds.length,
                        changedTableIds: tableIds,
                        payloadFormat: firstPayload.payloadFormat
                    }, null, 2));
                    // Log full first payload to see complete structure
                    console.log(`Webhook: Full first payload:`, JSON.stringify(firstPayload, null, 2));
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

        console.log(`Webhook: Processing ${allPayloads.length} payload(s) for form table: ${form.tableId}`);

        // Process each payload
        for (let i = 0; i < allPayloads.length; i++) {
            const payload = allPayloads[i];

            // Airtable v0 payload format uses changedTablesById instead of eventNotifications
            if (!payload.changedTablesById || typeof payload.changedTablesById !== 'object') {
                // No changes in this payload, skip
                continue;
            }

            // Process each table that has changes - but only process our form's table
            const tableIds = Object.keys(payload.changedTablesById);
            const filteredTableIds = tableIds.filter(id => id !== form.tableId);
            
            if (filteredTableIds.length > 0) {
                console.log(`Webhook: Filtering out ${filteredTableIds.length} table(s) not belonging to form (tableIds: ${filteredTableIds.join(', ')})`);
            }

            for (const [tableId, tableChanges] of Object.entries(payload.changedTablesById)) {
                // Filter: Only process changes for the table this form is connected to
                if (tableId !== form.tableId) {
                    stats.skipped++;
                    // Skip tables that don't belong to this form
                    continue;
                }

                // Process created records
                if (tableChanges.createdRecordsById) {
                    for (const [recordId, recordData] of Object.entries(tableChanges.createdRecordsById)) {
                        try {
                            stats.totalEvents++;
                            const response = await ResponseModel.findOne({ airtableRecordId: recordId, formId: form._id });

                            if (!response) {
                                stats.notFound++;
                                // Record created in Airtable but not in MongoDB (created directly in Airtable)
                                continue;
                            }

                            // Record already exists in MongoDB (created via form), update with latest values
                            if (recordData.cellValuesByFieldId) {
                                const updatedAnswers = mapCellValuesToAnswers(recordData.cellValuesByFieldId, form.questions);
                                response.answers = { ...response.answers, ...updatedAnswers };
                                response.updatedAt = new Date();
                                await response.save();
                                stats.processed++;
                                console.log(`Webhook: Response updated for created record ${recordId}`);
                            }
                        } catch (error) {
                            stats.errors++;
                            console.error(`Webhook: Error processing created record ${recordId}:`, error.message);
                        }
                    }
                }

                // Process changed/updated records
                if (tableChanges.changedRecordsById) {
                    for (const [recordId, recordData] of Object.entries(tableChanges.changedRecordsById)) {
                        try {
                            stats.totalEvents++;
                            
                            // Check if record was deleted (has previous but no current)
                            if (recordData.previous && !recordData.current) {
                                const response = await ResponseModel.findOne({ airtableRecordId: recordId, formId: form._id });
                                if (response) {
                                    response.deletedInAirtable = true;
                                    response.updatedAt = new Date();
                                    await response.save();
                                    stats.processed++;
                                    console.log(`Webhook: Response soft deleted for record ${recordId}`);
                                } else {
                                    stats.notFound++;
                                }
                                continue;
                            }

                            // Handle updated records
                            const response = await ResponseModel.findOne({ airtableRecordId: recordId, formId: form._id });

                            if (!response) {
                                stats.notFound++;
                                // Record changed in Airtable but not in MongoDB
                                continue;
                            }

                            // Update response with changed values
                            if (recordData.current && recordData.current.cellValuesByFieldId) {
                                const updatedAnswers = mapCellValuesToAnswers(recordData.current.cellValuesByFieldId, form.questions);
                                // Merge with existing answers, only updating changed fields
                                response.answers = { ...response.answers, ...updatedAnswers };
                                response.updatedAt = new Date();
                                await response.save();
                                stats.processed++;
                                console.log(`Webhook: Response updated for record ${recordId}`);
                            }
                        } catch (error) {
                            stats.errors++;
                            console.error(`Webhook: Error processing changed record ${recordId}:`, error.message);
                        }
                    }
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