const mongoose = require('mongoose');

const oauthStateSchema = new mongoose.Schema({
    state: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    codeVerifier: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 600 // Auto-delete after 10 minutes (3600 seconds)
    }
});

// Auto-cleanup expired documents (TTL index)
oauthStateSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('OAuthState', oauthStateSchema);