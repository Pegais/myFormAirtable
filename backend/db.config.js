const mongoose = require("mongoose");

module.exports=async()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("server to MongoDB is connected");
        
    } catch (error) {
        console.error(error);
    }
}