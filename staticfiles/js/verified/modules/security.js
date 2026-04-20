/**
 * Security Module
 * Phase 5: Security & Error Handling
 * 
 * Provides comprehensive security utilities including:
 * - XSS prevention (HTML escaping, sanitization)
 * - CSRF token management
 * - Input validation
 * - Content Security Policy helpers
 * - Secure data handling
 * 
 * @module Security
 * @version 1.0.0
 */

'use strict';

const Security = (function() {
    // ==================== Configuration ====================
    const CONFIG = {
        MAX_INPUT_LENGTH: 10000,
        ALLOWED_PROTOCOLS: ['http:', 'https:', 'mailto:'],
        DANGEROUS_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        DANGEROUS_ATTRS: ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
        CSRF_HEADER: 'X-CSRFToken',
        CSRF_COOKIE: 'csrftoken'
    };

    // ==================== XSS Prevention ====================

    /**
     * HTML entity map for escaping
     */
    const HTML_ENTITIES = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    /**
     * Escape HTML entities to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        
        return str.replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char] || char);
    }

    /**
     * Escape string for use in JavaScript context
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeJs(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        
        return str
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }

    /**
     * Escape string for use in URL
     * @param {string} str - String to escape
     * @returns {string} URL-encoded string
     */
    function escapeUrl(str) {
        if (str === null || str === undefined) return '';
        return encodeURIComponent(String(str));
    }

    /**
     * Escape string for use in CSS
     * @param {string} str - String to escape
     * @returns {string} CSS-safe string
     */
    function escapeCss(str) {
        if (str === null || str === undefined) return '';
        if (typeof str !== 'string') str = String(str);
        
        return str.replace(/[^\w-]/g, char => `\\${char.charCodeAt(0).toString(16)} `);
    }

    /**
     * Sanitize HTML by removing dangerous elements and attributes
     * @param {string} html - HTML string to sanitize
     * @param {Object} options - Sanitization options
     * @returns {string} Sanitized HTML
     */
    function sanitizeHtml(html, options = {}) {
        if (!html || typeof html !== 'string') return '';
        
        const {
            allowedTags = ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div'],
            allowedAttrs = ['class', 'id', 'style'],
            maxLength = CONFIG.MAX_INPUT_LENGTH
        } = options;

        // Truncate if too long
        if (html.length > maxLength) {
            html = html.substring(0, maxLength);
        }

        // Create a temporary element to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove dangerous tags
        CONFIG.DANGEROUS_TAGS.forEach(tag => {
            const elements = temp.getElementsByTagName(tag);
            while (elements.length > 0) {
                elements[0].parentNode.removeChild(elements[0]);
            }
        });

        // Remove dangerous attributes from all elements
        const allElements = temp.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            
            // Check if tag is allowed
            if (!allowedTags.includes(el.tagName.toLowerCase())) {
                // Replace with text content
                const text = document.createTextNode(el.textContent);
                el.parentNode.replaceChild(text, el);
                i--; // Adjust index since we removed an element
                continue;
            }

            // Remove dangerous and non-allowed attributes
            const attrs = Array.from(el.attributes);
            attrs.forEach(attr => {
                const attrName = attr.name.toLowerCase();
                if (CONFIG.DANGEROUS_ATTRS.includes(attrName) || 
                    attrName.startsWith('on') ||
                    !allowedAttrs.includes(attrName)) {
                    el.removeAttribute(attr.name);
                }
                // Check for javascript: URLs
                if (['href', 'src', 'action'].includes(attrName)) {
                    const value = attr.value.toLowerCase().trim();
                    if (value.startsWith('javascript:') || value.startsWith('data:')) {
                        el.removeAttribute(attr.name);
                    }
                }
            });
        }

        return temp.innerHTML;
    }

    /**
     * Strip all HTML tags, returning plain text
     * @param {string} html - HTML string
     * @returns {string} Plain text
     */
    function stripHtml(html) {
        if (!html || typeof html !== 'string') return '';
        
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    // ==================== CSRF Protection ====================

    /**
     * Get CSRF token from cookie
     * @returns {string|null} CSRF token
     */
    function getCSRFToken() {
        const name = CONFIG.CSRF_COOKIE;
        const cookies = document.cookie.split(';');
        
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(`${name}=`)) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }
        
        // Fallback: try meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        return metaTag ? metaTag.getAttribute('content') : null;
    }

    /**
     * Add CSRF token to headers object
     * @param {Object} headers - Headers object
     * @returns {Object} Headers with CSRF token
     */
    function addCSRFHeader(headers = {}) {
        const token = getCSRFToken();
        if (token) {
            headers[CONFIG.CSRF_HEADER] = token;
        }
        return headers;
    }

    /**
     * Create a hidden CSRF input field
     * @returns {HTMLInputElement} CSRF input element
     */
    function createCSRFInput() {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrfmiddlewaretoken';
        input.value = getCSRFToken() || '';
        return input;
    }

    // ==================== Input Validation ====================

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid
     */
    function isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email.trim()) && email.length <= 254;
    }

    /**
     * Validate URL format and protocol
     * @param {string} url - URL to validate
     * @param {string[]} allowedProtocols - Allowed protocols
     * @returns {boolean} True if valid
     */
    function isValidUrl(url, allowedProtocols = CONFIG.ALLOWED_PROTOCOLS) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const parsed = new URL(url);
            return allowedProtocols.includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Validate that input contains only alphanumeric characters
     * @param {string} str - String to validate
     * @returns {boolean} True if alphanumeric only
     */
    function isAlphanumeric(str) {
        if (!str || typeof str !== 'string') return false;
        return /^[a-zA-Z0-9]+$/.test(str);
    }

    /**
     * Validate input length
     * @param {string} str - String to validate
     * @param {number} min - Minimum length
     * @param {number} max - Maximum length
     * @returns {boolean} True if valid length
     */
    function isValidLength(str, min = 0, max = CONFIG.MAX_INPUT_LENGTH) {
        if (str === null || str === undefined) return min === 0;
        const len = String(str).length;
        return len >= min && len <= max;
    }

    /**
     * Validate number in range
     * @param {number} num - Number to validate
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean} True if valid
     */
    function isValidNumber(num, min = -Infinity, max = Infinity) {
        if (typeof num !== 'number' || isNaN(num)) return false;
        return num >= min && num <= max;
    }

    /**
     * Sanitize filename
     * @param {string} filename - Filename to sanitize
     * @returns {string} Sanitized filename
     */
    function sanitizeFilename(filename) {
        if (!filename || typeof filename !== 'string') return 'file';
        
        return filename
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.{2,}/g, '.')
            .replace(/^\.+|\.+$/g, '')
            .substring(0, 255);
    }

    // ==================== Secure Data Handling ====================

    /**
     * Safely parse JSON with error handling
     * @param {string} json - JSON string
     * @param {*} defaultValue - Default value on error
     * @returns {*} Parsed object or default value
     */
    function safeJsonParse(json, defaultValue = null) {
        if (!json || typeof json !== 'string') return defaultValue;
        
        try {
            return JSON.parse(json);
        } catch (error) {
            console.warn('[Security] JSON parse error:', error.message);
            return defaultValue;
        }
    }

    /**
     * Safely stringify object with circular reference handling
     * @param {*} obj - Object to stringify
     * @param {*} defaultValue - Default value on error
     * @returns {string} JSON string or default value
     */
    function safeJsonStringify(obj, defaultValue = '{}') {
        try {
            const seen = new WeakSet();
            return JSON.stringify(obj, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                return value;
            });
        } catch (error) {
            console.warn('[Security] JSON stringify error:', error.message);
            return defaultValue;
        }
    }

    /**
     * Create a safe copy of an object (deep clone without functions)
     * @param {Object} obj - Object to copy
     * @returns {Object} Safe copy
     */
    function safeCopy(obj) {
        return safeJsonParse(safeJsonStringify(obj), {});
    }

    /**
     * Mask sensitive data for logging
     * @param {string} data - Data to mask
     * @param {number} visibleChars - Number of visible characters at start/end
     * @returns {string} Masked string
     */
    function maskSensitiveData(data, visibleChars = 4) {
        if (!data || typeof data !== 'string') return '***';
        if (data.length <= visibleChars * 2) return '*'.repeat(data.length);
        
        const start = data.substring(0, visibleChars);
        const end = data.substring(data.length - visibleChars);
        const middle = '*'.repeat(Math.min(data.length - visibleChars * 2, 10));
        
        return `${start}${middle}${end}`;
    }

    // ==================== DOM Security ====================

    /**
     * Safely set innerHTML with sanitization
     * @param {HTMLElement} element - Target element
     * @param {string} html - HTML content
     * @param {Object} options - Sanitization options
     */
    function safeSetInnerHTML(element, html, options = {}) {
        if (!element || !(element instanceof HTMLElement)) return;
        element.innerHTML = sanitizeHtml(html, options);
    }

    /**
     * Safely create element with text content
     * @param {string} tag - Tag name
     * @param {string} text - Text content
     * @param {Object} attrs - Attributes
     * @returns {HTMLElement} Created element
     */
    function createSafeElement(tag, text = '', attrs = {}) {
        const allowedTags = ['div', 'span', 'p', 'a', 'button', 'input', 'select', 'option', 
                           'label', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'ul', 'li',
                           'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'i', 'b', 'br'];
        
        if (!allowedTags.includes(tag.toLowerCase())) {
            console.warn(`[Security] Blocked creation of potentially dangerous tag: ${tag}`);
            tag = 'div';
        }
        
        const element = document.createElement(tag);
        
        if (text) {
            element.textContent = text; // Safe - doesn't parse HTML
        }
        
        // Set safe attributes
        Object.entries(attrs).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();
            
            // Block dangerous attributes
            if (CONFIG.DANGEROUS_ATTRS.includes(lowerKey) || lowerKey.startsWith('on')) {
                console.warn(`[Security] Blocked dangerous attribute: ${key}`);
                return;
            }
            
            // Validate URLs
            if (['href', 'src', 'action'].includes(lowerKey)) {
                if (!isValidUrl(value) && !value.startsWith('/') && !value.startsWith('#')) {
                    console.warn(`[Security] Blocked invalid URL in ${key}: ${value}`);
                    return;
                }
            }
            
            element.setAttribute(key, escapeHtml(value));
        });
        
        return element;
    }

    // ==================== Rate Limiting ====================

    const rateLimiters = new Map();

    /**
     * Check if action is rate limited
     * @param {string} key - Rate limit key
     * @param {number} limit - Max actions
     * @param {number} windowMs - Time window in ms
     * @returns {boolean} True if allowed, false if rate limited
     */
    function checkRateLimit(key, limit = 10, windowMs = 60000) {
        const now = Date.now();
        
        if (!rateLimiters.has(key)) {
            rateLimiters.set(key, { count: 1, resetTime: now + windowMs });
            return true;
        }
        
        const limiter = rateLimiters.get(key);
        
        if (now > limiter.resetTime) {
            limiter.count = 1;
            limiter.resetTime = now + windowMs;
            return true;
        }
        
        if (limiter.count >= limit) {
            return false;
        }
        
        limiter.count++;
        return true;
    }

    /**
     * Reset rate limiter for a key
     * @param {string} key - Rate limit key
     */
    function resetRateLimit(key) {
        rateLimiters.delete(key);
    }

    // ==================== Public API ====================
    return {
        // XSS Prevention
        escapeHtml,
        escapeJs,
        escapeUrl,
        escapeCss,
        sanitizeHtml,
        stripHtml,
        
        // CSRF Protection
        getCSRFToken,
        addCSRFHeader,
        createCSRFInput,
        
        // Input Validation
        isValidEmail,
        isValidUrl,
        isAlphanumeric,
        isValidLength,
        isValidNumber,
        sanitizeFilename,
        
        // Secure Data Handling
        safeJsonParse,
        safeJsonStringify,
        safeCopy,
        maskSensitiveData,
        
        // DOM Security
        safeSetInnerHTML,
        createSafeElement,
        
        // Rate Limiting
        checkRateLimit,
        resetRateLimit,
        
        // Configuration
        CONFIG
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Security;
}
window.Security = Security;
