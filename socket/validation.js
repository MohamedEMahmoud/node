class SocketValidation {
    constructor(socketHelper) {
        this._socketHelper       = socketHelper;
        this._requiredProperties = ['userId', 'userType', 'name', 'lang', 'deviceType', 'deviceId'];
    }

    validate(socket) {
        try {
                for (const property of this._requiredProperties) {
                    if (!this._validateProperty(socket, property)) {
                        return false;
                    }
                    socket[property] = String(socket.handshake.query[property]);
                }

                if (!this._validateUserId(socket)) {
                    return false;
                }

                this._logValidatedProperties(socket);

                return true;
        } catch (error) {
            console.error('Error in socket validation:', error);
            this._socketHelper.handleSocketError(
                socket,
                'exception',
                'somethingWrong'
            );
            return false;
        }
    }

    _validateProperty(socket, property) {
        if (!socket.handshake.query[property]) {
            this._socketHelper.handleSocketError(socket, 'fail', `${property}required`, socket.lang || 'ar',true);
            return false;
        }

        socket[property] = String(socket.handshake.query[property]);

        return true;
    }

    _validateUserId(socket) {
        if (!Number(socket.handshake.query.userId)) {
            this._socketHelper.handleSocketError(socket, 'fail', 'userIdRequired', socket.lang || 'ar');
            return false;
        }

        return true;
    }
    _validateRoomId(socket, data) {
        if (!data?.room_id || isNaN(Number(data.room_id))) {
            console.log("Error in room_id");
            this._socketHelper.handleSocketError(
                socket,
                'fail',
                'roomIdRequired',
                socket.lang
            );
            return false;
        }
        return true;
    }

    validateSendMessage(socket, data) {
        if (!data?.room_id || isNaN(Number(data.room_id))) {
            console.log("Error in room_id");
            this._socketHelper.handleSocketError(
                socket,
                'fail',
                'roomIdRequired',
                socket.lang
            );
            return false;
        }
        if (
            !data?.type ||
            typeof data.type !== 'string' ||
            !['text', 'image', 'sound', 'video', 'file'].includes(data.type)
        ) {
            this._socketHelper.handleSocketError(
                socket,
                'fail',
                'invalidMessageType',
                socket.lang
            );
            return false;
        }
        if (
            !data?.body ||
            typeof data.body !== 'string'
        ) {
            this._socketHelper.handleSocketError(
                socket,
                'fail',
                'bodyRequired',
                socket.lang
            );
            return false;
        }

        if (data.type === 'sound') {
            if (!data.duration || isNaN(Number(data.duration))) {
                this._socketHelper.handleSocketError(socket, 'fail', 'durationRequired', socket.lang);
                return false;
            }
        }

        return true;
    }

    _logValidatedProperties(socket) {
        for (const property of this._requiredProperties) {
            console.log(`${property}:`, socket[property]);
        }
    }
    _validateNumberField(value, fieldName, socket) {
        console.log(fieldName)
        if (value === undefined || value === null || value === '') {
            this._socketHelper.handleSocketError(socket, 'fail', 'required', socket.lang || 'ar' , fieldName);
            return false;
        }

        if (isNaN(Number(value))) {
            this._socketHelper.handleSocketError(socket, 'fail','mustNumber', socket.lang || 'ar' ,fieldName);
            return false;
        }

        return true;
    }
}

module.exports = SocketValidation;
