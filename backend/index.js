require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
//app.use(cookieParser()); 
// enabling cors 
// CORS for regular API routes (with credentials)
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) {
            return callback(null, true);
        }
        
        // Allow frontend origin
        const normalizedOrigin = origin.replace(/\/$/, '');
        const normalizedFrontend = process.env.FRONTEND_URL?.replace(/\/$/, '');
        
        if (normalizedOrigin === normalizedFrontend) {
            return callback(null, true);
        }
        
        // For webhook routes, we'll allow all in the webhook router itself
        callback(null, true); // Allow all for now (temporary)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(cookieParser());
//enable sessions;
const session = require("express-session");
app.use(session({
    secret: process.env.SESSION_SECRET || "snehal_secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true,
        sameSite: 'none',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 //30 days
    }
}))

//enabling server to read and parse json;
app.use(express.json());

// Serve uploaded files publicly
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));

//connecting to DB;
const Db = require('./db.config');
const router = require("./routes/auth.routes");
Db();
const PORT = process.env.PORT;
// test route 
app.get('/', (req, res) => {
    res.send("server is running")
})

const formRouter = require("./routes/form.route");
//defining the api gateway for airtable api;
app.use('/auth', router)
//defining the api gateway for forms api;
app.use('/api/forms', formRouter);

//webhook api routes;
const webhookRouter = require("./routes/webhook.routes");
app.use('/webhooks', webhookRouter);

app.listen(PORT, () => {
    // console.log(`server running on PORT${PORT}`);

})