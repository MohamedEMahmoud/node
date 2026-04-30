const i18n               = require('i18n');
const Repo               = require('../src/db/repository/repo');
const FCM                = require('../src/fcm/fcm');
const ReturnObjectHelper = require('../src/helper/return-object');
const morph              = require('../src/helper/morph');

class SocketHelper {
    constructor() {
        this._users                          = new Map();
        this._chats                          = new Map();
        this._roomsRepository                = new Repo('rooms');
        this._messagesRepository             = new Repo('messages');
        this._membersRepository              = new Repo('room_members');
        this._messageNotificationsRepository = new Repo('message_notifications');
        this._fcmService                     = FCM;
        this._returnObjectHelper             = ReturnObjectHelper;
        this._typeMap                        = new Map(morph.map(({ key, value }) => [key, value]));
        this._reverseTypeMap                 = new Map(morph.map(({ key, value }) => [value, key]));
        this.userTypeRepo                   = new Map([
            ['user', new Repo('users')],
            ['provider', new Repo('providers')],
            ['delegate', new Repo('delegates')],
            ['admin', new Repo('admins')],
        ]);
    }

    join(socket, roomId) {
        try {
            return socket.join(String(roomId));
        } catch (error) {
            console.error('Error joining room:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
            return false;
        }
    }

    async online(socket) {
        try {
            console.log("online", socket.userId);

            const user = await this.userTypeRepo.get(socket.userType).find({
                where: {
                    id: socket.userId
                }
            });

            if (Object.keys(user).includes('online') && !user.online) {
                await this.userTypeRepo.get(socket.userType).update({
                    set: {
                        online: 1,
                        last_active_at: null
                    },
                    where: {
                        id: socket.userId
                    }
                });
            }

            return this._users.set(socket.userId, socket);
        } catch (error) {
            console.error('Error adding user:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
            return false;
        }
    }

    async offline(socket) {
        try {

            console.log("offline", socket.userId);

            const user = await this.userTypeRepo.get(socket.userType).find({
                where: {
                    id: socket.userId
                }
            });

            if (Object.keys(user).includes('last_active_at') && user.online) {
                await this.userTypeRepo.get(socket.userType).update({
                    set: {
                        online: 0,
                        last_active_at: new Date()
                    },
                    where: {
                        id: socket.userId
                    }
                });
            
            }

            return this._users.delete(socket.userId);

        } catch (error) {
            console.error('Error removing user:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
            return false;
        }
    }

    async enterChat(_io, socket, data) {
        try {

            const chatId = String(data.room_id);

            if (!this._chats.has(chatId)) {
                this._chats.set(chatId, new Map());
            }

            const chat = this._chats.get(chatId);

            if (!chat.has(socket.userId)) {
                const user = { id: socket.userId, type: socket.userType, lang: socket.lang, name: socket.name };
                const userKey = `${socket.userType}_${socket.userId}`;
                chat.set(userKey, user);

            }


            const repo =  this.userTypeRepo.get(socket.userType);

            await this._messageNotificationsRepository.update({
                set: {
                    is_seen: 1,
                },
                where: {
                    room_id: data.room_id,
                    userable_id: socket.userId,
                    userable_type: this._typeMap.get(socket.userType),
                    is_sender: 0,
                    is_seen: 0
                }
            });

            socket.chatId = chatId;

            socket.type   = 'chat';

            this.join(socket, chatId);
            return chatId;
        } catch (error) {
            console.error('Error in enterChat:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
            return null;
        }
    }

    async sendMessage(io, socket, data) {
        try {
            console.log("data in send message", data)
            const enrichedData = {
                ...data,
                sender_id: socket.userId,
                sender_type: socket.userType,
                sender_name: socket.name,
                avatar: socket.avatar,
                lang: socket.lang
            };

            console.log("enrichedData", enrichedData)
            const { insertId } =
                await this._messagesRepository.insert(
                    this._returnObjectHelper.insertMessage(enrichedData)
                );

            console.log("insertId",insertId)
            enrichedData.message_id = insertId;

            await this._roomsRepository.update({
                set: { last_message_id: insertId },
                where: { id: enrichedData.room_id }
            });


            const members =
                await this._membersRepository.find({
                    select: "*",
                    where: { room_id: enrichedData.room_id }
                });

            const processedMembers =
                this._processMembersForNotifications(members, enrichedData);


            await this._messageNotificationsRepository.insert(processedMembers);


            const messageNotifications =
                await this._messageNotificationsRepository.find({
                    where: { message_id: insertId }
                });


            const messageReceived =
                this._returnObjectHelper.messageReceived({
                    ...enrichedData,
                    id: insertId,
                    is_sender: 1,
                    is_seen: messageNotifications.is_seen||1
                });

            io.to(String(enrichedData.room_id))
                .emit('message-received', messageReceived);
                
            await this._sendOfflineNotifications(enrichedData, members);

            console.log("send message success", {
                message_id: insertId
            });

        } catch (error) {
            console.error('Error in sendMessage:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    exitChat(_io, socket, data) {
        try {
            const chatId = String(data.room_id);
            const chat   = this._chats.get(chatId);

            if (chat) {
                const userKey = `${socket.userType}_${socket.userId}`;
                chat.delete(userKey);

                if (chat.size === 0) {
                    this._chats.delete(chatId);
                }
            }

            socket.leave(chatId);
            console.log('exitChat Done success');

        } catch (error) {
            console.error('Error in exitChat:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async addTracker(io, socket, data) {
        try {
            const tracked_id = data.tracked_id;
            const roomName   = `delegate:${tracked_id}`;


            socket.join(roomName);

            console.log(`Tracker ${socket.userId} joined room ${roomName}`);
        } catch (error) {
            console.error('Error in addTracker:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async updateLocation(io, socket, data) {
        try {
            console.log("updatelocation", data);

            data.user_id = socket.userId;

            const repo =  this.userTypeRepo.get(socket.userType);
            console.log("repo",repo);
            const results = await repo.update({
                set: {
                    lat: data.lat,
                    lng: data.lng
                },
                where: {
                    id: data.user_id
                }
            });

            console.log("results", results);
            const roomName = `delegate:${data.user_id}`;
            console.log("data",data)
            io.to(roomName).emit("track-info", data);


            console.log("update location sent successfully");
        } catch (error) {
            console.error('Error in updateLocation:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async startCall(io, socket, data) {
        try {
            const chatId       = String(data.room_id);
            const dataReceived = { room_id: chatId, type: 'call', shareLink: data.shareLink };
            console.log("Start call data:", dataReceived);
            io.to(chatId).emit('message-received', dataReceived);
        } catch (error) {
            console.error('Error in startCall:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async returnFromCall(io, socket, data) {
        try {
            const chatId       = String(data.room_id);
            const dataReceived = { room_id: chatId, type: 'return-from-call'};
            io.to(chatId).emit('message-received', dataReceived);
        } catch (error) {
            console.error('Error in returnFromCall:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async rejectCall(io, socket, data) {
        try {
            const chatId       = String(data.room_id);
            const dataReceived = { room_id: chatId, type: 'call-rejected'};
            io.to(chatId).emit('message-received', dataReceived);
        } catch (error) {
            console.error('Error in rejectCall:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async answerCall(io, socket, data) {
        try {
            const chatId       = String(data.room_id);
            const dataReceived = { room_id: chatId, type: 'answer-call' };
            io.to(chatId).emit('message-received', dataReceived);
        } catch (error) {
            console.error('Error in answerCall:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    async disconnect(io, socket) {
        try {
            console.log("Disconnect:", socket?.type);

            if (socket?.type === 'chat') {
                this.exitChat(io, socket, { room_id: socket.chatId });
            }

            await this.offline(socket);
            return socket?.disconnect();
        } catch (error) {
            console.error('Error in disconnect:', error);
            this._handleSocketError(socket, 'exception', 'somethingWrong');
        }
    }

    _processMembersForNotifications(members, messageData) {
        const chatId = String(messageData.room_id);


        const chat = this._chats.get(chatId);

        const usersInsideChat = new Set(
            chat
                ? Array.from(chat.values()).map(user => {
                    return `${user.type}_${user.id}`;
                })
                : []
        );


        const senderTypeKey = this._reverseTypeMap.get(this._typeMap.get(messageData.sender_type)) || messageData.sender_type;
        const senderKey  = `${senderTypeKey}_${messageData.sender_id}`;

        return members.map(member => {


            const memberType = member.memberable_type;

            const memberTypeKey = this._reverseTypeMap.get(memberType) || memberType;
            const memberKey  = `${memberTypeKey}_${member.memberable_id}`;

            const isSender = memberKey === senderKey || Number(member.memberable_id) === Number(messageData.sender_id);

            const isSeen = isSender || usersInsideChat.has(memberKey) ? 1 : 0;

            const processedMember = {
                message_id: messageData.message_id,
                room_id: messageData.room_id,

                memberable_type: memberType,
                memberable_id: member.memberable_id,

                is_sender: isSender ? 1 : 0,
                is_seen: isSeen,
                seen_at: isSeen ? new Date() : null
            };

            return this._returnObjectHelper
                .membersWithMessageNotifications(processedMember);
        });
    }

    async _sendOfflineNotifications(messageData, members) {
        try {
            const chatId = String(messageData.room_id);
            const chat   = this._chats.get(chatId);

            console.log("chat",chat);
            if (!chat || chat.size === 0) {

                return;
            }

            const usersInsideChat = new Set(
                Array.from(chat.values()).map(user => {
                    return `${user.type}_${user.id}`;
                })
            );

            console.log("usersInsideChat",usersInsideChat);

            const senderTypeKey = this._reverseTypeMap.get(this._typeMap.get(messageData.sender_type)) || messageData.sender_type;

            const senderKey =
                `${senderTypeKey}_${messageData.sender_id}`;

            const receivers = members.filter(member => {


                const memberTypeKey = this._reverseTypeMap.get(member.memberable_type) || member.memberable_type;
                const memberKey =
                    `${memberTypeKey}_${member.memberable_id}`;

                const isSender = memberKey === senderKey || Number(member.memberable_id) === Number(messageData.sender_id);
                if (isSender) {
                    return false;
                }

                return !usersInsideChat.has(memberKey);
            });

            if (!receivers.length) {
                console.log('no notify');
                return;
            }

            console.log("will send notify success")

            const fcmData = this._returnObjectHelper.objFcm(messageData);

            await Promise.allSettled(
                receivers.map(receiver =>
                    this._fcmService.send({
                        ...fcmData,
                        receiver
                    })
                )
            );


        } catch (error) {
            console.error('Error in _sendOfflineNotifications:', error);
        }
    }

    handleSocketError(socket, key, message, lang = null, disconnect = false) {
        const errorLang     = lang || socket?.lang || 'ar';
        const errorResponse = this._errorHandler(key, message, errorLang);

        socket.emit('error-message', errorResponse);

        if (disconnect === true) {
            this.disconnect(null, socket);
        }
    }

    _handleSocketError(socket, key, message) {
        this.handleSocketError(socket, key, message);
    }

    _errorHandler(key, message, lang) {
        return {
            key: key,
            message: i18n.__({ phrase: message, locale: lang || 'ar' }),
            status: 400
        };
    }

}

module.exports = new SocketHelper();
