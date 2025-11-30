const router = require("express").Router();
const { handleAirtableWebhook } = require("../controllers/webhook.controller");

//webhooks= endpoint (they dont require authentication)

router.post('/airtable',handleAirtableWebhook);
module.exports = router;