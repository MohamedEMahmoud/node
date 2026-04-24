const axios              = require("axios");
const AccessTokenService = require("./access-token");
const key                = require("./firebase.json");

class NotificationSenderService {
    constructor(accessTokenService = null) {
        this._accessTokenService = accessTokenService || new AccessTokenService();
        this._projectId          = key.project_id;
        this._fcmEndpoint        = `https://fcm.googleapis.com/v1/projects/${this._projectId}/messages:send`;
    }

    async send(message) {
        try {
            const token   = await this._accessTokenService.getAccessToken();

            const payload = { message };

            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            };

            console.log("payload",payload);
            console.log("headers",headers);

            const response = await axios.post(this._fcmEndpoint, payload, { headers });
            console.log("Successfully sent message:", response.data);


            return response.data;
        } catch (error) {
            console.error("Error sending message:", error.response ? error.response.data : error.message);
            throw error;
        }
    }
}

module.exports = NotificationSenderService;
