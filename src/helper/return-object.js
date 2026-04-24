const moment               = require("moment");
const morph                = require("./morph");
const { APP_URL, STORAGE } = process.env;

class ReturnObjectHelper {
    constructor() {
        this._senderableType = '';
        this._morphMap       = morph;
    }

    getMorphRelation(senderType) {
        const found = this._morphMap.find(obj => obj.key === senderType);
        return found ? found.value : null;
    }

    insertMessage(data) {
        this._senderableType = this.getMorphRelation(data.sender_type) || '';

        const messageData    = {
            room_id: +data.room_id,
            senderable_id: +data.sender_id,
            senderable_type: this._senderableType,
            type: data.type,
            body: data.body,
            duration: data.duration || 0,
            name: data.sender_name || "",
            created_at: new Date(),
            updated_at: new Date()
        };

        console.log("messageData",messageData);
        return messageData;
    }

    messageReceived(data) {
        console.log("dataaaa",data)
        return {
            id: +data.id,
            sender_id: +data.sender_id,
            sender_type: data.sender_type,
            sender_name:data.sender_name,
            room_id: +data.room_id,
            body: ['image', 'sound', 'video', 'file'].includes(data.type) ? this.filePath(`images/rooms/${data.room_id}/${data.body}`) : data.body,
            type: data.type,
            duration: data.duration || 0,
            avatar: data.avatar || '',
            is_sender: data.is_sender,
            is_seen: data.is_seen,
            created_at: moment(new Date())
                .locale(data.lang)
                .fromNow(),
            updated_at: new Date(),
        };
    }

    membersWithMessageNotifications(data) {
        return {
            room_id: +data.room_id,
            message_id: +data.message_id,
            userable_type: data.memberable_type,
            userable_id: +data.memberable_id,
            is_seen: data.is_seen,
            is_sender: data.is_sender,
            is_flagged: 0,
            created_at: new Date(),
            updated_at: new Date()
        };
    }

    objFcm(data) {
        const senderableType = data.sender_type ? (this.getMorphRelation(data.sender_type) || '') : this._senderableType;
        const info= {
            sender_id: +data.sender_id,
            senderable_type: senderableType,
            room_id: +data.room_id,
            body: data.body,
            image:data.image||'',
            type: data.type,
            avatar: data.avatar || '',
            message_id:data.message_id,
            sender_name: data.sender_name,
            time: new Date()?.toISOString(),
            lang: data.lang || 'ar',
        };
        console.log("info data notify",info);
        return info;

    }

    filePath(path) {
        return `${APP_URL}/${STORAGE}/${path}/`;
    }
}

module.exports = new ReturnObjectHelper();
