const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");

//creating the authenticate function to check for token from cookies;
const authenticateUser = async (req,res,next)=>{
    try {
        //get token from cookies;
        const token = req.cookies?.token;
        //if token not found
        if(!token){
            return res.status(401).json({message:"Unauthorized"});
        };
        //verify the jwt token;
        const decoded = jwt.verify(token,process.env.JWT_SECRET);
        //get user from database;
        const user = await userModel.findOne({userId:decoded.userId});
        if(!user){
            return res.status(401).json({message:"User not found"});
        };
        //attach user to request object;
        req.user = user;
        next();
    } catch (error) {
        if(error.name === "JsonWebTokenError" || error.name === "TokenExpiredError"){
            return res.status(401).json({message:"Invalid or expired token"});
        };
        console.error("Auth: Middleware auth error:", error.message);
        return res.status(500).json({message:"Authentcation error"});
    }
}

module.exports = authenticateUser;