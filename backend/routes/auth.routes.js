const { Auth ,authCallback} = require("../controllers/userAuth.controller");

const router =require("express").Router();


router.get('/airtable',Auth);
router.get('/airtable/callback',authCallback);

module.exports=router;