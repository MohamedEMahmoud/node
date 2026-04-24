const { google } = require("googleapis");
const key        = require("./firebase.json");

class AccessTokenService {
    constructor(firebaseKey = null) {
        this._firebaseKey = firebaseKey || key;
        this._scopes      = ["https://www.googleapis.com/auth/firebase.messaging"];
    }

    async getAccessToken() {
        return new Promise((resolve, reject) => {
            try {
                const jwtClient = new google.auth.JWT(
                    this._firebaseKey.client_email,
                    null,
                    this._firebaseKey.private_key,
                    this._scopes,
                    null
                );

                jwtClient.authorize((err, tokens) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(tokens.access_token);
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = AccessTokenService;
