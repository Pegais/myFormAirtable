const { Auth ,authCallback, checkAuth} = require("../controllers/userAuth.controller");

const router =require("express").Router();


router.get('/airtable',Auth);
router.get('/airtable/callback',authCallback);
router.get('/check',checkAuth);

module.exports=router;