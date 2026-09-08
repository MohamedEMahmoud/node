const Repo                      = require('../db/repository/repo');
const NotificationSenderService = require('./send-notification');
const i18n                      = require('i18n');

class FCMService {
    constructor(notificationSender = null, devicesRepository = null) {
        this._devicesRepository = devicesRepository || new Repo('devices');
        this._notificationSender = notificationSender || new NotificationSenderService();
    }

    async send(data) {
        try {
            console.log("data123",data)
            let devices = await this._devicesRepository.find({
                select: "*",
                where: {
                    morph_id: data.receiver.memberable_id,
                    morph_type: data.receiver.memberable_type
                }
            });



            const notificationPromises = devices.map(device => this._sendNotify(device, data));

            return await Promise.all(notificationPromises);
        } catch (error) {
            console.error('Error in FCMService.send:', error);
            throw error;
        }
    }

    _formatBody(data, lang) {
        const locale = lang || 'ar';

        if (data.type === 'text') {
            return data.body || '';
        }

        // Image / file attachments: short translated body for the notification tray.
        if (data.type === 'image' || data.type === 'file') {
            return i18n.__({ phrase: 'attachment_sent', locale });
        }

        const phrase = `send_${data.type} {{name}}`;
        const translated = i18n.__({ phrase, locale }, { name: data.sender_name || '' });

        // i18n returns the phrase itself when the key is missing.
        if (!translated || translated === phrase) {
            return i18n.__({ phrase: 'attachment_sent', locale });
        }

        return translated;
    }

    _truncateText(text, maxLength = 200) {
        const textStr = String(text);
        return textStr.length > maxLength ? `${textStr.substring(0, maxLength)}.....` : textStr;
    }

    _buildMessagePayload(device, data) {
        const baseMessage = {
            token: device.device_id,

            notification: {
                title: data.sender_name,
                body: this._truncateText(this._formatBody(data, device.lang))
            },

            data: {
                title: data.sender_name,
                body_ar: this._truncateText(this._formatBody(data, 'ar')),
                body_en: this._truncateText(this._formatBody(data, 'en')),
                room_id: String(data.room_id),
                sender_id: String(data.sender_id),
                receiver_id: String(data.receiver.userable_id),
                type: data.type,
                sender_name: data.sender_name,
                avatar: data.avatar,
                key: 'new_message'
            }
        };

        console.log("baseMessage",baseMessage);

        if (device.device_type === 'ios' || device.device_type === 'android') {
            return {
                ...baseMessage,
                android: {
                    notification: {
                        sound: 'default'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default'
                        }
                    }
                }
            };
        }

        if (device.device_type === 'web') {
            return baseMessage;
        }

        return baseMessage;
    }
    async _sendNotify(device, data) {
        try {
            const message = this._buildMessagePayload(device, data);

            console.log("the notify send success");
            const res = await this._notificationSender.send(message);

            return res;
        } catch (error) {
            console.error('Error sending notification to device:', error);
            throw error;
        }
    }

}

module.exports = new FCMService();
