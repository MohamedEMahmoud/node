const SocketHelper     = require('./helper');
const SocketValidation = require('./validation');

class SocketHandler {
    constructor(io, socketHelper = null, socketValidation = null) {
        this._io               = io;
        this._socketHelper     = socketHelper || SocketHelper;
        this._socketValidation = socketValidation || new SocketValidation(this._socketHelper);
    }

    socketEvents() {
        this._io.on('connection', (socket) => {
            console.log('Socket connected:', socket.handshake.query);
            this._socketValidation.validate(socket);
            this._registerEventHandlers(socket);
        });
    }
    async _registerEventHandlers(socket) {
        console.log('Registering event handlers');
        try {
            
        await this._socketHelper.online(socket);

        socket.on('enter-chat', (data) => {
            console.log("Enter Chat",data)
            if (!this._socketValidation._validateRoomId(socket, data)) return;
            this._socketHelper.enterChat(this._io, socket, data);
        });

        socket.on('send-message', (data) => {
            console.log('Send message:', data);
            if (!this._socketValidation.validateSendMessage(socket, data)) return;
            this._socketHelper.sendMessage(this._io, socket, data);
        });

        socket.on('exit-chat', (data) => {
            console.log('Exit chat:', data);
            if (!this._socketValidation._validateRoomId(socket, data)) return;
            this._socketHelper.exitChat(this._io, socket, data);
        });

        socket.on('addTracker', (data) => {
            console.log('Add tracker:', data);
            if(!this._socketValidation._validateNumberField(data.tracked_id ,'tracked_id' ,socket) ) return;
            this._socketHelper.addTracker(this._io, socket, data);
        });

        socket.on("updateLocation", (data) => {
            console.log('Update location:', data);
            if(!this._socketValidation._validateNumberField(data.lat ,'lat' ,socket) || !this._socketValidation._validateNumberField(data.lng ,'lng' ,socket) ) return;
            this._socketHelper.updateLocation(this._io, socket, data);
        });

        socket.on('start-call', (data) => {
            console.log('Start call:', data);
            this._socketHelper.startCall(this._io, socket, data);
        });

        socket.on('answer-call', (data) => {
            console.log('Answer call:', data);
            this._socketHelper.answerCall(this._io, socket, data);
        });

        socket.on('reject-call', (data) => {
            console.log('Reject call:', data);
            this._socketHelper.rejectCall(this._io, socket, data);
        });

        socket.on('return-from-call', (data) => {
            console.log('Return from call:', data);
            this._socketHelper.returnFromCall(this._io, socket, data);
        });

        socket.on('disconnect', () => {
            console.log('Socket disconnected');
                this._socketHelper.disconnect(this._io, socket);
            });
        } catch (error) {
            console.error('Error in registerEventHandlers:', error);
            this._socketHelper.handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    socketConfig() {
        this.socketEvents();
    }
}

module.exports = SocketHandler;
