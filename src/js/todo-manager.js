/**
 * todo-manager.js
 * Manages the To Do List of targets to image
 */

const ToDoManager = {
    toDoList: [],

    /**
     * Initialize - load To Do list from database
     */
    async init() {
        await this.loadToDoList();
    },

    /**
     * Load To Do list from database
     */
    async loadToDoList() {
        try {
            this.toDoList = await DBManager.getAll(APP_CONFIG.STORES.TODO_TARGETS);
            console.log(`Loaded ${this.toDoList.length} targets in To Do list`);
        } catch (error) {
            console.error('Error loading To Do list:', error);
            this.toDoList = [];
        }
    },

    /**
     * Get all To Do list entries
     * @returns {Array} Array of To Do entries
     */
    getToDoList() {
        return this.toDoList;
    },

    /**
     * Get To Do list target IDs only
     * @returns {Array} Array of target ID strings
     */
    getToDoTargetIds() {
        return this.toDoList.map(entry => entry.targetId);
    },

    /**
     * Get full target objects for To Do list
     * @returns {Array} Array of target objects
     */
    getToDoTargets() {
        const targetIds = this.getToDoTargetIds();
        const allTargets = DataManager.getTargets();
        return allTargets.filter(target => targetIds.includes(target.object));
    },

    /**
     * Check if target is in To Do list
     * @param {string} targetId - Target identifier
     * @returns {boolean}
     */
    isInToDoList(targetId) {
        return this.toDoList.some(entry => entry.targetId === targetId);
    },

    /**
     * Get To Do list count
     * @returns {number}
     */
    getToDoCount() {
        return this.toDoList.length;
    },

    /**
     * Add target to To Do list
     * @param {string} targetId - Target identifier
     */
    async addToToDoList(targetId) {
        if (this.isInToDoList(targetId)) {
            console.log(`Target ${targetId} already in To Do list`);
            return;
        }

        // Generate date string (YYYYMMDD)
        const now = new Date();
        const addedDate = now.getUTCFullYear().toString() +
            (now.getUTCMonth() + 1).toString().padStart(2, '0') +
            now.getUTCDate().toString().padStart(2, '0');

        const entry = {
            targetId: targetId,
            addedDate: addedDate
        };

        await DBManager.put(APP_CONFIG.STORES.TODO_TARGETS, entry);
        this.toDoList.push(entry);

        console.log(`Added ${targetId} to To Do list`);

        // Dispatch event
        document.dispatchEvent(new CustomEvent('todo-list-updated'));
    },

    /**
     * Remove target from To Do list
     * @param {string} targetId - Target identifier
     */
    async removeFromToDoList(targetId) {
        if (!this.isInToDoList(targetId)) {
            console.log(`Target ${targetId} not in To Do list`);
            return;
        }

        await DBManager.delete(APP_CONFIG.STORES.TODO_TARGETS, targetId);
        this.toDoList = this.toDoList.filter(entry => entry.targetId !== targetId);

        console.log(`Removed ${targetId} from To Do list`);

        // Dispatch event
        document.dispatchEvent(new CustomEvent('todo-list-updated'));
    },

    /**
     * Clear entire To Do list
     */
    async clearToDoList() {
        const store = APP_CONFIG.STORES.TODO_TARGETS;
        const targetIds = this.getToDoTargetIds();

        for (const targetId of targetIds) {
            await DBManager.delete(store, targetId);
        }

        this.toDoList = [];
        console.log('Cleared To Do list');

        // Dispatch event
        document.dispatchEvent(new CustomEvent('todo-list-updated'));
    },

    /**
     * Get To Do list entry for a target
     * @param {string} targetId - Target identifier
     * @returns {Object|null}
     */
    getToDoEntry(targetId) {
        return this.toDoList.find(entry => entry.targetId === targetId) || null;
    }
};
