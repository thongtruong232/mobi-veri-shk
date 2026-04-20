/**
 * Utility Functions Module
 * Provides common utility functions used throughout the verified page
 * @module Utils
 */

'use strict';

const Utils = (function() {
    /**
     * Get cookie value by name
     * @param {string} name - Cookie name
     * @returns {string|null} Cookie value or null if not found
     */
    function getCookie(name) {
        if (!name || typeof name !== 'string') return null;
        
        const cookies = document.cookie.split(';');
        const prefix = `${name.trim()}=`;
        
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(prefix)) {
                return decodeURIComponent(cookie.substring(prefix.length));
            }
        }
        return null;
    }

    /**
     * Get CSRF token from cookie
     * @returns {string|null} CSRF token
     */
    function getCSRFToken() {
        return getCookie('csrftoken');
    }

    /**
     * Format date to DD/MM/YYYY HH:MM
     * @param {Date|string|number} dateInput - Date input
     * @returns {string} Formatted date string
     */
    function formatDate(dateInput) {
        try {
            if (!dateInput) return '';
            
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
            
            if (isNaN(date.getTime())) return '';
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (error) {
            console.warn('Error formatting date:', error, dateInput);
            return '';
        }
    }

    /**
     * Format date to DD/MM/YYYY
     * @param {Date|string|number} dateInput - Date input
     * @returns {string} Formatted date string
     */
    function formatDateToDDMMYYYY(dateInput) {
        try {
            if (!dateInput) return '';
            
            const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
            
            if (isNaN(date.getTime())) return '';
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.warn('Error formatting date to DD/MM/YYYY:', error, dateInput);
            return '';
        }
    }

    /**
     * Parse and format date from various formats to DD/MM/YYYY
     * Supports: d/m/yyyy, d/m/yy, ISO format, and Date objects
     * @param {Date|string} dateInput - Date input
     * @returns {string|null} Formatted date string or null if invalid
     */
    function formatDateDDMMYYYY(dateInput) {
        if (!dateInput) return null;
        
        let dateObj;
        
        if (typeof dateInput === 'string') {
            // Try parsing d/m/yyyy or d/m/yy format
            const dmyMatch = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
            if (dmyMatch) {
                const day = parseInt(dmyMatch[1], 10);
                const month = parseInt(dmyMatch[2], 10);
                let year = parseInt(dmyMatch[3], 10);
                
                // Handle 2-digit years
                if (year < 100) {
                    year = year < 50 ? 2000 + year : 1900 + year;
                }
                dateObj = new Date(year, month - 1, day);
            } else {
                // Try ISO format or other standard formats
                dateObj = new Date(dateInput);
            }
        } else if (dateInput instanceof Date) {
            dateObj = dateInput;
        } else {
            return null;
        }
        
        // Validate date
        if (isNaN(dateObj.getTime())) return null;
        
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        
        return `${day}/${month}/${year}`;
    }

    /**
     * Get today's date in YYYY-MM-DD format (for input[type="date"])
     * @returns {string} Today's date formatted as YYYY-MM-DD
     */
    function getTodayDateString() {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    /**
     * Sanitize data to prevent XSS attacks
     * @param {*} data - Data to sanitize
     * @returns {string} Sanitized string
     */
    function sanitizeData(data) {
        try {
            if (data === null || data === undefined) return '';
            
            if (typeof data === 'string') {
                return data
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/'/g, "\\'");
            }
            
            if (typeof data === 'number' || typeof data === 'boolean') {
                return String(data);
            }
            
            if (typeof data === 'object') {
                return JSON.stringify(data)
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/'/g, "\\'");
            }
            
            return String(data);
        } catch (error) {
            console.warn('Error sanitizing data:', error, data);
            return '';
        }
    }

    /**
     * Get CSS class for status badge
     * @param {string} status - Status value
     * @returns {string} CSS class name
     */
    function getStatusClass(status) {
        if (!status) return 'status-default';
        
        const statusStr = String(status).toLowerCase().trim();
        
        const statusMap = {
            'verified': 'status-verified',
            'success': 'status-success',
            'error': 'status-error',
            'resend link': 'status-resend-link',
            'other password': 'status-not-reg',
            'not reg': 'status-not-reg'
        };
        
        return statusMap[statusStr] || 'status-default';
    }

    /**
     * Format price to Vietnamese currency format
     * @param {number} price - Price value
     * @returns {string} Formatted price string
     */
    function formatPrice(price) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    }

    /**
     * Sleep/delay function
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Debounce function to limit rate of function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function to limit rate of function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    function throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Batch DOM updates using requestAnimationFrame
     * Groups multiple DOM operations into a single frame for better performance
     * @param {Function} callback - Function containing DOM updates
     * @returns {Promise<void>} Resolves after the RAF callback
     */
    function batchDOMUpdate(callback) {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                callback();
                resolve();
            });
        });
    }

    /**
     * Create a batched update queue that processes updates in RAF
     * Useful for multiple rapid updates to the same elements
     * @returns {Object} Queue object with add() and flush() methods
     */
    function createUpdateQueue() {
        let updates = [];
        let rafId = null;

        function flush() {
            if (updates.length === 0) return;
            
            const batch = [...updates];
            updates = [];
            rafId = null;

            requestAnimationFrame(() => {
                batch.forEach(fn => {
                    try {
                        fn();
                    } catch (error) {
                        console.error('Error in batched update:', error);
                    }
                });
            });
        }

        return {
            add(fn) {
                updates.push(fn);
                if (!rafId) {
                    rafId = requestAnimationFrame(flush);
                }
            },
            flush() {
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }
                flush();
            },
            clear() {
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                updates = [];
            }
        };
    }

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Parse full_information string to object
     * @param {string} fullInfo - Full information string (email|password|token|client_id)
     * @returns {Object|null} Parsed object or null if invalid
     */
    function parseFullInfo(fullInfo) {
        if (!fullInfo || typeof fullInfo !== 'string') return null;
        
        const parts = fullInfo.split('|').map(p => p.trim());
        if (parts.length < 4) return null;
        
        const [email, password_email, refresh_token, client_id] = parts;
        
        if (!email || !password_email || !refresh_token || !client_id) return null;
        
        return { email, password_email, refresh_token, client_id };
    }

    // Public API
    return {
        getCookie,
        getCSRFToken,
        formatDate,
        formatDateToDDMMYYYY,
        formatDateDDMMYYYY,
        getTodayDateString,
        sanitizeData,
        getStatusClass,
        formatPrice,
        sleep,
        debounce,
        throttle,
        batchDOMUpdate,
        createUpdateQueue,
        isValidEmail,
        parseFullInfo
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
window.Utils = Utils;
