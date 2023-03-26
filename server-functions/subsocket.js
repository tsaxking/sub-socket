const { CachedData } = require("./cached-data");

class ErrorReason {
    /**
     * 
     * @param {String} event 
     * @param {String} reason 
     * @param {Number} statusCode  
     */
    constructor(event, reason, statusCode) {
        this.reason = reason;
        this.statusCode = statusCode;
        this.event = event;
    }
}

class ClientListener {
    /**
     * @callback eventCallback
     * @param {Any} data The original data
     * @param {Any} newData The new data
     * @param {Any} criteria The criteria used to get the orignal data
     */

    /**
     * @callback buildCallback
     * @param {Any[]} criteria The criteria used to get the data
     * @returns {Any} The data to send to the client
     */

    /**
     * 
     * @param {String} event 
     * @param {eventCallback} callback
     * @param {buildCallback} buildData
     * @param {Object} options
     */
    constructor(event, callback, buildData, options = {}) {
        if (typeof event !== "string") throw new Error("event must be a string, received " + typeof event);
        if (typeof callback !== "function") throw new Error("callback must be a function, received " + typeof callback);
        if (typeof buildData !== "function") throw new Error("dataBuilder must be a function, received " + typeof buildData);

        /**
         * @type {String} The event name
         */
        this.event = event;

        /**
         * @type {Function} The callback function
         */
        this.callback = callback;

        /**
         * @type {CachedData} The cached data
         */
        this.data = new CachedData(buildData);

        /**
         * @type {Object} Options
         */
        this.options = options;
    }

    /**
     * Sends update to all clients
     * @param {Websocket} socket
     * @param {Any[]} criteria
     */
    async update(socket, criteria) {
        const newData = await this.data.getData(criteria);
        if (this.options.emitAll) {
            socket.emit(this.event, criteria, newData);
        }
        socket.broadcast.emit(this.event, criteria, newData);
    }

    /**
     * Fires when a client sends an update
     * @param {Any} newData New data to update with
     * @param {Any} criteria Criteria to check
     * @returns 
     */
    async onUpdate(socket, criteria = [], newData) {
        const data = await this.data.getData(criteria);
        if (data) {
            this.callback(data, newData, criteria);
            this.update(socket, criteria);
            return true;
        } else {
            return new ErrorReason(this.event, "Invalid criteria", 400);
        }
    }

    /**
     * @returns {Object} Several functions to use as middleware
     * @property {Function} middlware The middleware function
     * @property {Function} discord The discord middleware function
     */
    get updates() {
        return {
            /**
             * express middleware
             * @param {Request} req 
             * @param {Response} res 
             * @param {Function} next 
             */
            middlware: async(req,res,next) => {
                if (req.method === 'POST' && req.url === `/${this.event.split(':').join('/')}`) {
                    const {
                        criteria,
                        data: newData
                    } = req.body;

                    const success = await this.onUpdate(newData, criteria);

                    if (success) res.status(200).json({});
                    else res.status(400).json({});
                } else next();
            },
            /**
             * Discord 
             */
            discord: async() => {}
        }
    }
}







class SubSocket {
    static #subSockets = {};

    /**
     * @type {Object} subSockets
     */
    static get subSockets() {
        return SubSocket.#subSockets
    }

    /**
     * This is not used, it's just to annotate the "static set subSocket"
     * @private
     * @type {SubSocket} subSocket
     */
    static get subSocket() {}

    /**
     * @type {SubSocket} subSocket
     */
    static set subSocket(subSocket) {
        if (!(subSocket instanceof SubSocket)) throw new Error("subSocket must be a SubSocket");
        SubSocket.#subSockets[subSocket.name] = subSocket;
    }

    /**
     * @callback initCallback
     * @param {Any} criteria The criteria used to get the data
     * @returns {Any} The data to send to the client
     */

    /**
     * @param {String} name The name of the subsocket
     * @param {initCallback} init Cached data initialization function
     * 
     */
    constructor(name, init, options = {}) {
        if (typeof name !== 'string') throw new Error("name must be a string, received " + typeof name);

        if (!init) init = () => ({}); // Default init function
        if (typeof init !== "function") throw new Error("init must be a function, received " + typeof init);

        if (SubSocket.subSockets[name]) throw new Error("Subsocket already exists");

        /**
         * @type {String} The name of the subsocket
         */
        this.name = name;

        /**
         * @type {Object} Listeners for the subsocket
         * @private
         */
        this.listeners = {};

        /**
         * @type {CachedData} Cached data for the subsocket
         */
        this.initData = new CachedData(init);

        SubSocket.subSocket = this;

        /**
         * @type {Object} Options for the subsocket
         */
        this.options = options;
    }

    /**
     * @callback eventCallback
     * @param {Any} data The original data
     * @param {Any} newData The new data
     * @param {Any} criteria The criteria used to get the orignal data
     */

    /**
     * @callback buildCallback
     * @param {Any[]} criteria The criteria used to get the data
     * @returns {Any} The data to send to the client
     */

    /**
     * 
     * @param {String} event 
     * @param {eventCallback} eventCallback
     * @param {buildCallback} buildData
     * 
     * @returns {Object} Object containing several functions to use for updating the data
     */
    on(event, eventCallback, buildData) {
        if (typeof event !== "string") throw new Error("event must be a string, received " + typeof event);
        if (typeof eventCallback !== "function") throw new Error("callback must be a function, received " + typeof eventCallback);

        if (!buildData) {
            buildData = () => this.initData.getData();
        }

        if (typeof buildData !== "function") throw new Error("dataBuilder must be a function, received " + typeof buildData);

        if (this.listeners[event]) throw new Error("Listener already exists");

        const listener = new ClientListener(event, eventCallback, buildData, this.options);
        this.listeners[this.name + ':' + event] = listener;

        return listener.updates;
    }

    /**
     * 
     * @param {WebSocket} socket Adds a socket onto the socket 
     */
    setSocket(socket) {
        socket.onAny((event, ...args) => {
            const [name] = event.split(':');
            if (name === this.name) {
                const listener = this.listeners[event];
                if (listener) listener.onUpdate(socket, ...args);
            }
        });
    }

    get middleware() {
        /**
         * @callback NextFunction
         * @returns {void}
         */
        /**
         * express middleware
         * @param {Request} req
         * @param {Response} res
         * @param {NextFunction} next
         */
        return async (req, res, next) => {
            if (req.method === 'POST' && req.url === `/${this.name}/init`) {
                if (req.headers['x-subsocket'] !== this.name) return res.status(400).json({
                    error: "Invalid subsocket"
                });

                const { 
                    criteriaList
                } = req.body;

                // res.status(200).json(await this.initData.getData([key]));

                if (criteriaList) {
                    const data = await Promise.all(
                        criteriaList.map(async criteria => {
                            return await this.initData.getData(criteria);
                        })
                    );

                    res.status(200).json(data);
                }
                else {
                    res.status(200).json(await this.initData.getData());
                }
            } else next();
        }
    }


    /**
     * Triggers an event
     * @param {String} event 
     * @param {Array} criteria 
     * @param {Any} newData 
     */
    trigger(event, criteria = [], newData) {
        if (typeof event !== "string") throw new Error("event must be a string, received " + typeof event);
        if (!Array.isArray(criteria)) throw new Error("criteria must be an array, received " + typeof criteria);
        if (!newData) throw new Error("newData must be defined");

        const listener = this.listeners[this.name + ':' + event];
        if (listener) listener.callback(criteria, newData);

        return listener;
    }
}


module.exports = SubSocket;