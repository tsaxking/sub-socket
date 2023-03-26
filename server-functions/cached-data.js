class CachedData {
    /**
     * @callback buildDataFunction
     * @param {String} id
     */

    /**
     * 
     * @param {buildDataFunction} buildData Returns a promise that resolves to the data 
     */
    constructor(buildData) {
        if (typeof buildData !== "function") throw new Error("getData must be a function");

        /**
         * @type {Object} Key-Value pairs of branches of the data
         * @private
         */
        this.content = {};

        /**
         * @type {Function} Returns a promise that resolves to the data
         */
        this.buildData = buildData;

        /**
         * @type {Object} Key-Value pairs of timeouts
         * @private
         */
        this.timeouts = {};
    }

    /**
     * 
     * @param {Any[]} criteria Criteria to get the data
     * @returns {CachedData | Any} The data
     */
    async getData(criteria = []) {
        const id = criteria.shift();

        let content = this.content[id];
        if (!content) {
            content = await this.buildData(id);
            this.content[id] = content;
        }

        this.timeouts[id] = setTimeout(() => this.deleteData(id), 1000 * 60 * 30);

        if (content instanceof CachedData) {
            if (criteria.length) return await content.getData(criteria);
            else return content.content;
        }
        else return content;
    }

    /**
     * Deletes the data from the cache and clears the timeout
     * @param {String} id
     * @private 
     */
    deleteData(id) {
        if (this.content[id] instanceof CachedData) this.content[id].deleteData(id);
        clearTimeout(this.timeouts[id]);
        delete this.content[id];
        delete this.timeouts[id];
    }
}

module.exports = { CachedData };