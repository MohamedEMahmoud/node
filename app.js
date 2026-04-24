require('dotenv').config({ path: require('path').join(__dirname, '../.env') }).parsed;

const fs                                                          = require('fs');
const express                                                     = require('express');
const socketIo                                                    = require('socket.io');
const http                                                        = require('http');
const https                                                       = require('https');
const path                                                        = require('path');
const SocketHandler                                               = require('./socket/socket');
const i18n                                                        = require('i18n');
const { NODE_PORT, APP_URL, NODE_MODE, NODE_HOST, KEY, CERT, CA } = process.env;

class Server {
    constructor() {
        this._app    = express();
        this._server = null;
        this._io     = null;
        this._initialize();
    }

    _initialize() {
        try {
            this._configureLocales();
            this._startServer();
            this._connectSocket();
        } catch (error) {
            console.error('Error initializing server:', error);
            process.exit(1);
        }
    }

    _startServer() {
        console.log(NODE_MODE )
        this._server = NODE_MODE === "live" ? this._createHttpsServer(): this._createHttpServer();

        this._server.listen(NODE_PORT, NODE_HOST, () => {
            console.log(`Server listening on ${NODE_MODE === "live" ? "https" : "http"}://${NODE_HOST}:${NODE_PORT}`);
        });

        this._server.on('error', (error) => {
            console.error('Server error:', error);
            process.exit(1);
        });
    }

    _createHttpsServer() {
        try {
                const credentials = {
                    key: fs.readFileSync(KEY, "utf8"),
                    cert: fs.readFileSync(CERT, "utf8"),
                    ca: fs.readFileSync(CA, "utf8"),
                    requestCert: false,
                    rejectUnauthorized: false
                };

                return https.createServer(credentials, this._app);
        } catch (error) {
            console.error('Error creating HTTPS server:', error);
            throw new Error('Failed to create HTTPS server. Please check certificate files.');
        }
    }

    _createHttpServer() {
        return http.createServer(this._app);
    }

    _configureLocales() {
        i18n.configure({
            locales: ['ar', 'en'],
            directory: path.join(__dirname, "./src/locales"),
            defaultLocale: 'ar',
            updateFiles: false
        });
    }

    _connectSocket() {
        if (!this._server) {
            throw new Error('Server must be initialized before connecting Socket.IO');
        }

        this._io = socketIo(this._server, {
            allowEIO3: true,
            cors: {
                origin: APP_URL,
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        const socketHandler = new SocketHandler(this._io);

        socketHandler.socketConfig();
    }

    getApp() {
        return this._app;
    }

    getServer() {
        return this._server;
    }

    getIO() {
        return this._io;
    }

    async shutdown() {
        return new Promise((resolve) => {
            if (this._server) {
                this._server.close(() => {
                    console.log('Server closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = new Server();
