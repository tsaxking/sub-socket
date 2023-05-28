const SubSocket = require('./subsocket.js');
const CachedData = require('./cached-data.js');








module.exports = class SocketManager {
    static SubSocket = SubSocket;
    static CachedData = CachedData;
    static setApp(app) {};
}