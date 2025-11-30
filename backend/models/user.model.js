const mongoose =require("mongoose");

const userSchema=new mongoose.Schema({
  userId:{
    type:String,
    required:true,
    unique:true
  },
  profile:{
    type:Object,
    required:true
  },
  accessToken:{
    type:String,
    required:true
  },
  refreshToken:{
    type:String,
    default:null
  },
  lastActivity:{
    type:Date,
    default:Date.now
  }


}
);

module.exports=mongoose.model('User',userSchema);