// CLIENT SIDE

const subSockets = {};
class SubSocket {
    /**
     * 
     * @param {String} name 
     * @param {WebSocket} socket 
     */
    constructor(name, socket) {
        if (typeof name !== "string") throw new Error("name must be a string");
        if (subSockets[name]) throw new Error("There is already a subsocket with the name " + name);

        /**
         * @type {String} The name of the subsocket
         */
        this.name = name;

        /**
         * @type {WebSocket} The websocket
         */
        this.socket = socket;

        /**
         * @type {Any} The data
         */
        this.data = null;

        /**
         * @type {Object} The listeners
         * @private
         * @property {ServerListener} [event] The listener
         */
        this.listeners = {};

        this.socket.onAny((event, ...args) => {
            if (this.listeners[event]) this.listeners[event].onUpdate(...args);
        });

        subSockets[name] = this;
    }

    /**
     * Initializes the data
     * @param  {any} key (first parameter of criteria) 
     */
    async init(criteriaList = []) {
        this.data = await fetch('/' + this.name + '/init', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'x-subsocket': this.name
            },
            body: JSON.stringify({ criteriaList })
        }).then(res => res.json()).catch(err => {
            console.error(err);
            return null;
        });
    }

    /**
     * 
     * @param {String} event Event name 
     * @returns {ServerListener} The listener
     */
    on(event) {
        if (this.listeners[event]) throw new Error("There is already a listener for the event " + event);
        this.listeners[event] = new ServerListener(this.name + ':' + event, this.socket);
        return this.listeners[event];
    }
}