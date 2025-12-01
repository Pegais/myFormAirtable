const router = require("express").Router();
const { submitFormResponse, getFormResponses, uploadFile } = require("../controllers/response.controller");
const authenticateUser = require("../middlewares/auth.middleware");

//Public route no auth needed;
router.post('/:formId/responses',submitFormResponse);

//File upload route (public - no auth needed for form submission)
router.post('/:formId/upload', uploadFile);

//protected routes require authentication;
router.get('/:formId/responses',authenticateUser,getFormResponses);

module.exports = router;