const router = require("express").Router();
const { submitFormResponse, getFormResponses } = require("../controllers/response.controller");
const authenticateUser = require("../middlewares/auth.middleware");

//Public route no auth needed;
router.post('/:formId/responses',submitFormResponse);

//protected routes require authentication;
router.get('/:formId/responses',authenticateUser,getFormResponses);

module.exports = router;