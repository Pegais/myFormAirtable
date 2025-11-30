const router = require("express").Router();
const { getBases, getTables, getFields, createForm, getForms, getFormById, getFormForPublicView, deleteForm, updateForm } = require("../controllers/forms.controller");
const authenticateUser  = require("../middlewares/auth.middleware");
const responseRouter = require("./response.route");

//defininf the public route no auth needed;
router.get('/:formId/view',getFormForPublicView);

//all routes below require authentication;
router.use(authenticateUser);

router.get('/bases',getBases);
router.get('/bases/:baseId/tables',getTables);
router.get('/bases/:baseId/tables/:tableId/fields',getFields);

//form CRUD operations;
router.post('/',createForm);
router.get('/',getForms);
router.get('/:formId',getFormById);
router.delete('/:formId',deleteForm);
router.put('/:formId',updateForm);

//response routes are nested under form routes;
router.use('/',responseRouter);

module.exports = router;