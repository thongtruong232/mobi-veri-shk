/**
 * State Manager Module
 * Phase 4: Centralized State Management
 * 
 * Provides a centralized, observable state management system with:
 * - Single source of truth for application state
 * - Subscription-based change notifications
 * - State persistence (localStorage)
 * - State history for debugging
 * - Computed/derived state support
 * 
 * @module StateManager
 * @version 1.0.0
 */

'use strict';

const StateManager = (function() {
    // ==================== Configuration ====================
    const CONFIG = {
        STORAGE_KEY: 'verified_app_state',
        MAX_HISTORY_SIZE: 50,
        DEBUG_MODE: false,  // Set to true to enable console logging
        PERSIST_KEYS: ['userOffice', 'isTextNowStatus', 'preferences']  // Keys to persist
    };

    // ==================== Initial State ====================
    const initialState = {
        // User & Authentication
        userOffice: '',
        csrftoken: '',
        
        // API Configuration
        apiData: {
            api_dongvan: '',
            api_fmail: '',
            api_phapsu: ''
        },
        
        // Records & Data
        records: [],
        selectedRecords: new Set(),
        totalRecords: 0,
        
        // UI State
        isTextNowStatus: true,
        isLoading: false,
        loadingMessage: '',
        
        // Edit Modal State
        editModal: {
            isOpen: false,
            email: '',
            statusTN: '',
            statusTF: '',
            isEditingTextNow: true
        },
        
        // Search/Filter State
        filters: {
            date: '',
            status: '',
            createdBy: ''
        },
        
        // Pagination (if needed in future)
        pagination: {
            currentPage: 1,
            pageSize: 100,
            totalPages: 1
        },
        
        // User Preferences
        preferences: {
            autoSearch: true,
            showNotifications: true,
            compactView: false
        },
        
        // Application Meta
        initialized: false,
        lastUpdated: null,
        error: null
    };

    // ==================== Internal State ====================
    let state = deepClone(initialState);
    const subscribers = new Map();  // key -> Set of callbacks
    const computedGetters = new Map();  // key -> getter function
    const stateHistory = [];
    let historyIndex = -1;

    // ==================== Utility Functions ====================
    
    /**
     * Deep clone an object (handles Set, Map, Date)
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Set) return new Set([...obj]);
        if (obj instanceof Map) return new Map([...obj]);
        if (Array.isArray(obj)) return obj.map(item => deepClone(item));
        
        const cloned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = deepClone(obj[key]);
            }
        }
        return cloned;
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Source object
     * @param {string} path - Dot-notation path (e.g., 'editModal.email')
     * @returns {*} Value at path
     */
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => 
            current && current[key] !== undefined ? current[key] : undefined, obj);
    }

    /**
     * Set nested value in object using dot notation
     * @param {Object} obj - Target object
     * @param {string} path - Dot-notation path
     * @param {*} value - Value to set
     */
    function setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Check if two values are deeply equal
     * @param {*} a - First value
     * @param {*} b - Second value
     * @returns {boolean} True if equal
     */
    function deepEqual(a, b) {
        if (a === b) return true;
        if (a instanceof Set && b instanceof Set) {
            if (a.size !== b.size) return false;
            for (const item of a) if (!b.has(item)) return false;
            return true;
        }
        if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
            return false;
        }
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(key => deepEqual(a[key], b[key]));
    }

    /**
     * Log state changes in debug mode
     * @param {string} action - Action name
     * @param {Object} payload - Action payload
     */
    function debugLog(action, payload) {
        if (CONFIG.DEBUG_MODE) {
            console.group(`[StateManager] ${action}`);
            console.log('Payload:', payload);
            console.log('New State:', deepClone(state));
            console.groupEnd();
        }
    }

    // ==================== Core State Methods ====================

    /**
     * Get current state or a specific key
     * @param {string} [key] - Optional dot-notation key
     * @returns {*} State value
     */
    function getState(key) {
        if (!key) return deepClone(state);
        
        // Check computed getters first
        if (computedGetters.has(key)) {
            return computedGetters.get(key)(state);
        }
        
        return deepClone(getNestedValue(state, key));
    }

    /**
     * Set state value(s)
     * @param {string|Object} keyOrUpdates - Key string or update object
     * @param {*} [value] - Value if key is string
     * @param {Object} [options] - Options { silent: boolean, persist: boolean }
     */
    function setState(keyOrUpdates, value, options = {}) {
        const { silent = false, persist = true } = options;
        const previousState = deepClone(state);
        const changedKeys = [];

        if (typeof keyOrUpdates === 'string') {
            // Single key update
            const oldValue = getNestedValue(state, keyOrUpdates);
            if (!deepEqual(oldValue, value)) {
                setNestedValue(state, keyOrUpdates, deepClone(value));
                changedKeys.push(keyOrUpdates);
            }
        } else if (typeof keyOrUpdates === 'object') {
            // Batch update
            for (const [key, val] of Object.entries(keyOrUpdates)) {
                const oldValue = getNestedValue(state, key);
                if (!deepEqual(oldValue, val)) {
                    setNestedValue(state, key, deepClone(val));
                    changedKeys.push(key);
                }
            }
        }

        if (changedKeys.length === 0) return;

        // Update metadata
        state.lastUpdated = Date.now();

        // Save to history
        saveToHistory(previousState);

        // Debug logging
        debugLog('setState', { keys: changedKeys, value: keyOrUpdates });

        // Notify subscribers
        if (!silent) {
            notifySubscribers(changedKeys);
        }

        // Persist to localStorage
        if (persist) {
            persistState();
        }
    }

    /**
     * Reset state to initial values
     * @param {string[]} [keys] - Specific keys to reset, or all if omitted
     */
    function resetState(keys) {
        if (keys && Array.isArray(keys)) {
            const updates = {};
            keys.forEach(key => {
                updates[key] = getNestedValue(initialState, key);
            });
            setState(updates);
        } else {
            state = deepClone(initialState);
            notifySubscribers(['*']);
            persistState();
        }
        debugLog('resetState', { keys });
    }

    // ==================== Subscription System ====================

    /**
     * Subscribe to state changes
     * @param {string|string[]} keys - State key(s) to watch ('*' for all)
     * @param {Function} callback - Callback function(newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(keys, callback) {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        
        keyArray.forEach(key => {
            if (!subscribers.has(key)) {
                subscribers.set(key, new Set());
            }
            subscribers.get(key).add(callback);
        });

        // Return unsubscribe function
        return () => {
            keyArray.forEach(key => {
                const subs = subscribers.get(key);
                if (subs) {
                    subs.delete(callback);
                    if (subs.size === 0) {
                        subscribers.delete(key);
                    }
                }
            });
        };
    }

    /**
     * Notify subscribers of state changes
     * @param {string[]} changedKeys - Keys that changed
     */
    function notifySubscribers(changedKeys) {
        const notified = new Set();

        changedKeys.forEach(key => {
            // Notify exact key subscribers
            if (subscribers.has(key)) {
                subscribers.get(key).forEach(callback => {
                    if (!notified.has(callback)) {
                        notified.add(callback);
                        try {
                            callback(getState(key), key);
                        } catch (error) {
                            console.error(`[StateManager] Subscriber error for key "${key}":`, error);
                        }
                    }
                });
            }

            // Notify parent key subscribers (e.g., 'editModal' when 'editModal.email' changes)
            const parts = key.split('.');
            for (let i = 1; i < parts.length; i++) {
                const parentKey = parts.slice(0, i).join('.');
                if (subscribers.has(parentKey)) {
                    subscribers.get(parentKey).forEach(callback => {
                        if (!notified.has(callback)) {
                            notified.add(callback);
                            try {
                                callback(getState(parentKey), parentKey);
                            } catch (error) {
                                console.error(`[StateManager] Subscriber error for key "${parentKey}":`, error);
                            }
                        }
                    });
                }
            }
        });

        // Notify wildcard subscribers
        if (subscribers.has('*')) {
            subscribers.get('*').forEach(callback => {
                if (!notified.has(callback)) {
                    notified.add(callback);
                    try {
                        callback(getState(), '*');
                    } catch (error) {
                        console.error('[StateManager] Wildcard subscriber error:', error);
                    }
                }
            });
        }
    }

    // ==================== Computed State ====================

    /**
     * Register a computed getter
     * @param {string} key - Computed key name
     * @param {Function} getter - Getter function(state) => value
     */
    function computed(key, getter) {
        computedGetters.set(key, getter);
    }

    // Register default computed values
    computed('selectedCount', (s) => s.selectedRecords.size);
    computed('hasSelection', (s) => s.selectedRecords.size > 0);
    computed('isFiltered', (s) => s.filters.date || s.filters.status || s.filters.createdBy);
    computed('statusTypeLabel', (s) => s.isTextNowStatus ? 'TextNow' : 'TextFree');

    // ==================== History Management ====================

    /**
     * Save current state to history
     * @param {Object} previousState - State before change
     */
    function saveToHistory(previousState) {
        // Remove any forward history if we're not at the end
        if (historyIndex < stateHistory.length - 1) {
            stateHistory.splice(historyIndex + 1);
        }

        stateHistory.push(previousState);
        historyIndex = stateHistory.length - 1;

        // Limit history size
        if (stateHistory.length > CONFIG.MAX_HISTORY_SIZE) {
            stateHistory.shift();
            historyIndex--;
        }
    }

    /**
     * Undo last state change
     * @returns {boolean} True if undo was successful
     */
    function undo() {
        if (historyIndex < 0) return false;

        const previousState = stateHistory[historyIndex];
        historyIndex--;
        
        state = deepClone(previousState);
        notifySubscribers(['*']);
        
        debugLog('undo', { historyIndex });
        return true;
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    function canUndo() {
        return historyIndex >= 0;
    }

    // ==================== Persistence ====================

    /**
     * Persist state to localStorage
     */
    function persistState() {
        try {
            const toPersist = {};
            CONFIG.PERSIST_KEYS.forEach(key => {
                const value = getNestedValue(state, key);
                if (value !== undefined) {
                    // Convert Set to Array for JSON serialization
                    if (value instanceof Set) {
                        toPersist[key] = { __type: 'Set', data: [...value] };
                    } else {
                        toPersist[key] = value;
                    }
                }
            });
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(toPersist));
        } catch (error) {
            console.warn('[StateManager] Failed to persist state:', error);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    function loadPersistedState() {
        try {
            const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                Object.entries(parsed).forEach(([key, value]) => {
                    // Restore Set from Array
                    if (value && value.__type === 'Set') {
                        setNestedValue(state, key, new Set(value.data));
                    } else {
                        setNestedValue(state, key, value);
                    }
                });
                debugLog('loadPersistedState', parsed);
            }
        } catch (error) {
            console.warn('[StateManager] Failed to load persisted state:', error);
        }
    }

    /**
     * Clear persisted state
     */
    function clearPersistedState() {
        try {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
        } catch (error) {
            console.warn('[StateManager] Failed to clear persisted state:', error);
        }
    }

    // ==================== Actions (State Mutations) ====================

    /**
     * Pre-defined actions for common state changes
     */
    const actions = {
        // User/Auth Actions
        setUserOffice(office) {
            setState('userOffice', office);
        },

        setApiData(data) {
            setState('apiData', { ...state.apiData, ...data });
        },

        setCsrfToken(token) {
            setState('csrftoken', token);
        },

        // Records Actions
        setRecords(records) {
            setState({
                records: records,
                totalRecords: records.length,
                selectedRecords: new Set()
            });
        },

        selectRecord(email) {
            const newSelected = new Set(state.selectedRecords);
            newSelected.add(email);
            setState('selectedRecords', newSelected);
        },

        deselectRecord(email) {
            const newSelected = new Set(state.selectedRecords);
            newSelected.delete(email);
            setState('selectedRecords', newSelected);
        },

        toggleRecordSelection(email) {
            const newSelected = new Set(state.selectedRecords);
            if (newSelected.has(email)) {
                newSelected.delete(email);
            } else {
                newSelected.add(email);
            }
            setState('selectedRecords', newSelected);
        },

        selectAllRecords() {
            const allEmails = state.records
                .filter(r => r.status_account_TN !== 'verified')
                .map(r => r.email);
            setState('selectedRecords', new Set(allEmails));
        },

        deselectAllRecords() {
            setState('selectedRecords', new Set());
        },

        // UI Actions
        setLoading(isLoading, message = '') {
            setState({
                isLoading,
                loadingMessage: message
            });
        },

        toggleStatusType() {
            setState('isTextNowStatus', !state.isTextNowStatus);
        },

        setError(error) {
            setState('error', error);
        },

        clearError() {
            setState('error', null);
        },

        // Edit Modal Actions
        openEditModal(email, statusTN, statusTF) {
            setState('editModal', {
                isOpen: true,
                email,
                statusTN: statusTN || '',
                statusTF: statusTF || '',
                isEditingTextNow: state.isTextNowStatus
            });
        },

        closeEditModal() {
            setState('editModal', {
                ...state.editModal,
                isOpen: false
            });
        },

        toggleEditStatusType() {
            setState('editModal.isEditingTextNow', !state.editModal.isEditingTextNow);
        },

        // Filter Actions
        setFilters(filters) {
            setState('filters', { ...state.filters, ...filters });
        },

        clearFilters() {
            setState('filters', {
                date: '',
                status: '',
                createdBy: ''
            });
        },

        // Preferences Actions
        setPreference(key, value) {
            setState(`preferences.${key}`, value);
        },

        // Initialization
        setInitialized(initialized) {
            setState('initialized', initialized);
        }
    };

    // ==================== Selectors (Derived State) ====================

    /**
     * Pre-defined selectors for common queries
     */
    const selectors = {
        getSelectedEmails() {
            return [...state.selectedRecords];
        },

        getRecordByEmail(email) {
            return state.records.find(r => r.email === email);
        },

        getFilteredRecords() {
            let records = state.records;
            const { status, createdBy } = state.filters;

            if (status) {
                const statusField = state.isTextNowStatus ? 'status_account_TN' : 'status_account_TF';
                records = records.filter(r => r[statusField] === status);
            }

            if (createdBy) {
                records = records.filter(r => r.created_by === createdBy);
            }

            return records;
        },

        getVerifiedRecords() {
            return state.records.filter(r => r.status_account_TN === 'verified');
        },

        getUnverifiedRecords() {
            return state.records.filter(r => r.status_account_TN !== 'verified');
        },

        getCurrentEditStatus() {
            return state.editModal.isEditingTextNow 
                ? state.editModal.statusTN 
                : state.editModal.statusTF;
        }
    };

    // ==================== Initialization ====================

    /**
     * Initialize the state manager
     * @param {Object} [initialValues] - Initial state values to merge
     */
    function init(initialValues = {}) {
        // Load persisted state first
        loadPersistedState();

        // Merge any provided initial values
        if (Object.keys(initialValues).length > 0) {
            Object.entries(initialValues).forEach(([key, value]) => {
                setNestedValue(state, key, value);
            });
        }

        debugLog('init', { initialValues, state: deepClone(state) });
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled
     */
    function setDebugMode(enabled) {
        CONFIG.DEBUG_MODE = enabled;
    }

    /**
     * Get state snapshot for debugging
     * @returns {Object}
     */
    function getSnapshot() {
        return {
            state: deepClone(state),
            subscriberCount: subscribers.size,
            historyLength: stateHistory.length,
            historyIndex
        };
    }

    // ==================== Public API ====================
    return {
        // Core methods
        getState,
        setState,
        resetState,
        
        // Subscriptions
        subscribe,
        computed,
        
        // History
        undo,
        canUndo,
        
        // Persistence
        persistState,
        loadPersistedState,
        clearPersistedState,
        
        // Pre-defined actions
        actions,
        
        // Pre-defined selectors
        selectors,
        
        // Initialization & debugging
        init,
        setDebugMode,
        getSnapshot
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateManager;
}
window.StateManager = StateManager;
