require("dotenv").config();
const express = require("express");

const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
//app.use(cookieParser()); 
// enabling cors 
app.use(cors(
    {
        origin: process.env.FRONTEND_URL,
        credentials: true
    }));

//enable sessions;
const session = require("express-session");
app.use(session({
    secret:process.env.SESSION_SECRET ||"snehal_secret_key",
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:process.env.NODE_ENV === "production",
        maxAge:30*24*60*60*1000 //30 days
    }
}))
app.use(cookieParser());
//enabling server to read and parse json;
app.use(express.json());

//connecting to DB;
const Db =require('./db.config');
const router = require("./routes/auth.routes");
Db();
const PORT =process.env.PORT;
// test route 
app.get('/',(req,res)=>{
    res.send("server is running")
})

const formRouter = require("./routes/form.route");
//defining the api gateway for airtable api;
app.use('/auth',router)
//defining the api gateway for forms api;
app.use('/api/forms',formRouter);

//webhook api routes;
const webhookRouter = require("./routes/webhook.routes");
app.use('/webhooks',webhookRouter);

app.listen(PORT,()=>{
    console.log(`server running on PORT${PORT}`);
    
})