const crypto =require("crypto");

//making helper function for PKCE flow;
// PKCE needs : code_verifier(a random string 43-128 chars);
//code_challenge:SHA256 hash of the verifier;

//usage :
// /auth/airtable: send code_challenge, code_challenge_method=S256
// /auth/airtable/callback: send the stored code_verifier


function VerificationGenerator(){
    return crypto.randomBytes(32).toString("base64url");
}

const hashFromVerifier=(verifier)=>{
    const hash =crypto.createHash('sha256').update(verifier).digest();
    //creating hash;
    return Buffer.from(hash).toString("base64url");
}

const createRandomState=()=>{
    return crypto.randomBytes(32).toString("base64url");
}
module.exports={
    VerificationGenerator,
    hashFromVerifier,
    createRandomState
}