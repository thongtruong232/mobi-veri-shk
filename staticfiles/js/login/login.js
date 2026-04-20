/**
 * Login Page JavaScript Module
 * @module LoginApp
 * @version 3.0.0
 * @description Handles login form, OTP verification with security, accessibility and error handling
 * 
 * PHASE 3: Code Organization
 * PHASE 4: UX/UI Improvements
 * PHASE 5: Accessibility (a11y) Support
 * PHASE 6: Error Handling & Resilience
 * PHASE 7: Modern JavaScript (ES2020+, No jQuery)
 */

'use strict';

/**
 * Main Login Application
 * Uses IIFE to avoid global namespace pollution
 */
const LoginApp = (function() {
    
    // ==================== CONFIGURATION ====================
    const CONFIG = Object.freeze({
        OTP_DURATION: 5 * 60,      // 5 minutes in seconds
        MAX_OTP_ATTEMPTS: 5,       // Maximum OTP attempts
        LOCKOUT_DURATION: 30,      // Lockout duration in seconds
        USERNAME_PATTERN: /^[a-zA-Z0-9_@.+-]+$/,
        OTP_PATTERN: /^[0-9]{6}$/,
        USERNAME_MAX_LENGTH: 150,
        PASSWORD_MAX_LENGTH: 128,
        // PHASE 6: Error handling configuration
        MAX_RETRY_ATTEMPTS: 3,     // Maximum retry attempts for API calls
        RETRY_DELAY: 1000,         // Initial retry delay in ms
        RETRY_MULTIPLIER: 2,       // Exponential backoff multiplier
        REQUEST_TIMEOUT: 30000,    // Request timeout in ms (30 seconds)
        OFFLINE_CHECK_INTERVAL: 5000, // Check online status every 5 seconds
        // PHASE 7: Animation durations
        ANIMATION_DURATION: 300,   // Default animation duration in ms
        DEBOUNCE_DELAY: 1000        // Debounce delay for input validation (increased for better UX)
    });

    // ==================== PHASE 7: MODERN UTILITY FUNCTIONS ====================
    
    /**
     * DOM query helper with optional caching
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @returns {Element|null}
     */
    const $ = (selector, context = document) => context.querySelector(selector);
    
    /**
     * DOM query all helper
     * @param {string} selector - CSS selector
     * @param {Element} context - Context element
     * @returns {NodeList}
     */
    const $$ = (selector, context = document) => context.querySelectorAll(selector);
    
    /**
     * Create element with attributes and children
     * @param {string} tag - Element tag name
     * @param {Object} attrs - Attributes object
     * @param {...(string|Element)} children - Child elements or text
     * @returns {Element}
     */
    const createElement = (tag, attrs = {}, ...children) => {
        const element = document.createElement(tag);
        
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Element) {
                element.appendChild(child);
            }
        });
        
        return element;
    };
    
    /**
     * Debounce function execution
     * @param {Function} fn - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function}
     */
    const debounce = (fn, delay = CONFIG.DEBOUNCE_DELAY) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    };
    
    /**
     * Throttle function execution
     * @param {Function} fn - Function to throttle
     * @param {number} limit - Minimum time between calls in ms
     * @returns {Function}
     */
    const throttle = (fn, limit) => {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };
    
    /**
     * Safe JSON parse with fallback
     * @param {string} json - JSON string
     * @param {*} fallback - Fallback value
     * @returns {*}
     */
    const safeJsonParse = (json, fallback = null) => {
        try {
            return JSON.parse(json);
        } catch {
            return fallback;
        }
    };
    
    /**
     * Check if value is nullish (null or undefined)
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    const isNullish = (value) => value === null || value === undefined;

    // ==================== UTILITY FUNCTIONS ====================
    
    /**
     * Get CSRF token from meta tag
     * @returns {string} CSRF token
     */
    const getCSRFToken = () => $('meta[name="csrf-token"]')?.content ?? '';

    /**
     * Create FormData with CSRF token
     * @param {Object} data - Key-value pairs to add
     * @returns {FormData}
     */
    const createFormData = (data = {}) => {
        const formData = new FormData();
        formData.append('csrfmiddlewaretoken', getCSRFToken());
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value);
        });
        return formData;
    };

    // ==================== SECURITY MODULE ====================
    
    /**
     * Security utilities for input validation and sanitization
     * @namespace SecurityUtils
     */
    const SecurityUtils = {
        /**
         * Sanitize input to prevent XSS
         * @param {string} input - Raw input string
         * @returns {string} Sanitized string
         */
        sanitizeInput(input) {
            if (typeof input !== 'string') return '';
            const entities = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            };
            return input.trim().replace(/[<>"'&]/g, match => entities[match]);
        },

        /**
         * Validate username format
         * @param {string} username - Username to validate
         * @returns {boolean} True if valid
         */
        isValidUsername(username) {
            return CONFIG.USERNAME_PATTERN.test(username) && 
                   username.length <= CONFIG.USERNAME_MAX_LENGTH;
        },

        /**
         * Validate OTP format (6 digits)
         * @param {string} otp - OTP to validate
         * @returns {boolean} True if valid
         */
        isValidOTP(otp) {
            return CONFIG.OTP_PATTERN.test(otp);
        }
    };

    // ==================== RATE LIMITER MODULE ====================
    
    /**
     * Rate limiter to prevent brute force attacks
     * @namespace RateLimiter
     */
    const RateLimiter = {
        attempts: 0,
        lockedUntil: null,

        /**
         * Check if currently locked out
         * @returns {boolean} True if locked
         */
        isLocked() {
            if (!this.lockedUntil) return false;
            if (Date.now() < this.lockedUntil) return true;
            this.reset();
            return false;
        },

        /**
         * Record a failed attempt
         * @returns {boolean} True if now locked
         */
        recordAttempt() {
            this.attempts++;
            if (this.attempts >= CONFIG.MAX_OTP_ATTEMPTS) {
                this.lockedUntil = Date.now() + (CONFIG.LOCKOUT_DURATION * 1000);
                return true;
            }
            return false;
        },

        /**
         * Get remaining attempts
         * @returns {number} Remaining attempts
         */
        getRemainingAttempts() {
            return Math.max(0, CONFIG.MAX_OTP_ATTEMPTS - this.attempts);
        },

        /**
         * Get remaining lockout time in seconds
         * @returns {number} Seconds remaining
         */
        getLockoutRemaining() {
            if (!this.lockedUntil) return 0;
            return Math.max(0, Math.ceil((this.lockedUntil - Date.now()) / 1000));
        },

        /**
         * Reset the rate limiter
         */
        reset() {
            this.attempts = 0;
            this.lockedUntil = null;
        }
    };

    // ==================== OTP TIMER MODULE ====================
    
    /**
     * OTP countdown timer
     * @namespace OTPTimer
     */
    const OTPTimer = {
        remaining: CONFIG.OTP_DURATION,
        intervalId: null,
        onExpireCallback: null,

        /**
         * Start the countdown timer
         * @param {Function} onExpire - Callback when timer expires
         */
        start(onExpire) {
            this.remaining = CONFIG.OTP_DURATION;
            this.onExpireCallback = onExpire;
            this.updateDisplay();

            this.intervalId = setInterval(() => {
                this.remaining--;
                this.updateDisplay();

                if (this.remaining <= 0) {
                    this.stop();
                    if (typeof this.onExpireCallback === 'function') {
                        this.onExpireCallback();
                    }
                }
            }, 1000);
        },

        /**
         * Stop the timer
         */
        stop() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        },

        /**
         * Update the display element
         */
        updateDisplay() {
            // PHASE 7: Use cached element or query helper
            const countdownEl = $('#otpCountdown');
            if (!countdownEl) return;

            const minutes = Math.floor(this.remaining / 60);
            const seconds = this.remaining % 60;
            const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            countdownEl.textContent = display;

            // Change color when low time (< 60 seconds)
            const timerContainer = countdownEl.closest('.alert');
            timerContainer?.classList.toggle('alert-warning', this.remaining > 60);
            timerContainer?.classList.toggle('alert-danger', this.remaining <= 60);
        }
    };

    // ==================== UI MODULE ====================
    
    /**
     * UI helper functions
     * @namespace UI
     */
    const UI = {
        elements: {},

        /**
         * Cache DOM elements - PHASE 7: Using $ helper
         */
        cacheElements() {
            // PHASE 7: Use shorthand $ helper for cleaner code
            this.elements = {
                loginForm: $('#loginForm'),
                loginBtn: $('#loginBtn'),
                username: $('#username'),
                password: $('#password'),
                honeypot: $('#website'),
                otpModal: $('#otpModal'),
                otpInput: $('#otpInput'),
                otpError: $('#otpError'),
                otpSuccess: $('#otpSuccess'),
                verifyBtn: $('#verifyOtpBtn'),
                rateLimitWarning: $('#rateLimitWarning'),
                lockoutTimer: $('#lockoutTimer'),
                attemptsInfo: $('#attemptsInfo'),
                otpTimer: $('#otpTimer'),
                // PHASE 4: New UI elements
                togglePassword: $('#togglePassword'),
                eyeIcon: $('#eyeIcon'),
                eyeOffIcon: $('#eyeOffIcon'),
                rememberUsername: $('#rememberUsername'),
                usernameFeedback: $('#usernameFeedback'),
                passwordFeedback: $('#passwordFeedback'),
                resendOtpBtn: $('#resendOtpBtn'),
                resendCooldown: $('#resendCooldown'),
                // PHASE 5: Accessibility elements
                loginStatus: $('#loginStatus'),
                messageRegion: $('#messageRegion'),
                otpErrorText: $('#otpErrorText'),
                otpSuccessText: $('#otpSuccessText'),
                verifyStatus: $('#verifyStatus'),
                resendStatus: $('#resendStatus')
            };
        },

        /**
         * Show error message in OTP modal
         * @param {string} message - Error message
         */
        showOtpError(message) {
            const { otpError, otpErrorText } = this.elements;
            if (!otpError) return;
            
            // PHASE 7: Optional chaining and nullish coalescing
            (otpErrorText ?? otpError).textContent = message;
            otpError.classList.remove('d-none');
            otpError.focus();
        },

        /**
         * Show success message in OTP modal
         * @param {string} message - Success message
         */
        showOtpSuccess(message) {
            const { otpSuccess, otpSuccessText } = this.elements;
            if (!otpSuccess) return;
            
            // PHASE 7: Optional chaining and nullish coalescing
            (otpSuccessText ?? otpSuccess).textContent = message;
            otpSuccess.classList.remove('d-none');
        },

        /**
         * Hide OTP messages
         */
        hideOtpMessages() {
            const { otpError, otpSuccess, otpErrorText, otpSuccessText } = this.elements;
            otpError?.classList.add('d-none');
            otpSuccess?.classList.add('d-none');
            // PHASE 7: Nullish assignment
            if (otpErrorText) otpErrorText.textContent = '';
            if (otpSuccessText) otpSuccessText.textContent = '';
        },

        /**
         * Show login form error - PHASE 7: Using createElement helper
         * @param {string} message - Error message
         */
        showLoginError(message) {
            let errorDiv = $('.login-error');
            if (!errorDiv) {
                errorDiv = createElement('div', {
                    className: 'alert alert-danger login-error',
                    role: 'alert',
                    'aria-live': 'assertive'
                });
                this.elements.loginForm?.prepend(errorDiv);
            }
            errorDiv.textContent = message;
            errorDiv.classList.remove('d-none');
        },

        /**
         * Set verify button loading state - PHASE 7: Using optional chaining
         * @param {boolean} isLoading - Loading state
         */
        setVerifyButtonLoading(isLoading) {
            const { verifyBtn, verifyStatus } = this.elements;
            if (!verifyBtn) return;

            verifyBtn.disabled = isLoading;
            
            // PHASE 7: Cleaner toggle with optional chaining
            const btnText = $('.btn-text', verifyBtn);
            const btnLoader = $('.btn-loader', verifyBtn);
            
            btnText?.classList.toggle('d-none', isLoading);
            btnLoader?.classList.toggle('d-none', !isLoading);
            
            // PHASE 5: Announce to screen readers
            if (verifyStatus) {
                verifyStatus.textContent = isLoading ? 'Verifying OTP, please wait...' : '';
            }
        },

        /**
         * Update attempts info display - PHASE 7: Cleaner conditionals
         */
        updateAttemptsInfo() {
            const { attemptsInfo } = this.elements;
            if (!attemptsInfo) return;

            const remaining = RateLimiter.getRemainingAttempts();
            const { MAX_OTP_ATTEMPTS } = CONFIG;
            
            // PHASE 7: Object for state management
            const states = {
                warning: remaining < MAX_OTP_ATTEMPTS && remaining > 0,
                locked: remaining === 0,
                normal: remaining >= MAX_OTP_ATTEMPTS
            };
            
            if (states.warning) {
                attemptsInfo.textContent = ` ${remaining} attempt(s) remaining`;
                attemptsInfo.classList.remove('d-none', 'text-danger');
            } else if (states.locked) {
                attemptsInfo.textContent = 'Temporarily locked';
                attemptsInfo.classList.add('text-danger');
            } else {
                attemptsInfo.textContent = '';
            }
        },

        /**
         * Show rate limit warning with countdown - PHASE 7: Cleaner syntax
         */
        showRateLimitWarning() {
            const { rateLimitWarning, lockoutTimer, verifyBtn, otpInput } = this.elements;
            
            rateLimitWarning?.classList.remove('d-none');
            if (verifyBtn) verifyBtn.disabled = true;
            if (otpInput) otpInput.disabled = true;

            // PHASE 7: Use arrow function for cleaner interval
            const updateTimer = setInterval(() => {
                const remaining = RateLimiter.getLockoutRemaining();
                if (lockoutTimer) lockoutTimer.textContent = remaining;

                if (remaining <= 0) {
                    clearInterval(updateTimer);
                    rateLimitWarning?.classList.add('d-none');
                    if (verifyBtn) verifyBtn.disabled = false;
                    if (otpInput) otpInput.disabled = false;
                    RateLimiter.reset();
                    this.updateAttemptsInfo();
                }
            }, 1000);
        }
    };

    // ==================== MODAL MANAGER ====================
    
    /**
     * Bootstrap Modal manager with lazy initialization - PHASE 7: Enhanced
     * @namespace ModalManager
     */
    const ModalManager = {
        instances: new Map(),

        /**
         * Get or create modal instance
         * @param {string} id - Modal element ID
         * @returns {bootstrap.Modal|null} Modal instance
         */
        get(id) {
            if (!this.instances.has(id)) {
                const element = $(`#${id}`);
                if (element && typeof bootstrap !== 'undefined') {
                    this.instances.set(id, new bootstrap.Modal(element));
                }
            }
            return this.instances.get(id) ?? null;
        },

        /**
         * Show modal by ID
         * @param {string} id - Modal element ID
         */
        show(id) {
            this.get(id)?.show();
        },

        /**
         * Hide modal by ID
         * @param {string} id - Modal element ID
         */
        hide(id) {
            this.get(id)?.hide();
        },
        
        /**
         * PHASE 7: Dispose modal instance
         * @param {string} id - Modal element ID
         */
        dispose(id) {
            const modal = this.instances.get(id);
            if (modal) {
                modal.dispose();
                this.instances.delete(id);
            }
        }
    };

    // ==================== PHASE 4: PASSWORD TOGGLE ====================
    
    /**
     * Password visibility toggle
     * @namespace PasswordToggle
     */
    const PasswordToggle = {
        isVisible: false,
        
        /**
         * Initialize password toggle functionality
         */
        init() {
            const { togglePassword, password, eyeIcon, eyeOffIcon } = UI.elements;
            if (!togglePassword || !password) return;
            
            togglePassword.addEventListener('click', () => this.toggle());
        },
        
        /**
         * Toggle password visibility
         */
        toggle() {
            const { password, eyeIcon, eyeOffIcon, togglePassword } = UI.elements;
            if (!password) return;
            
            this.isVisible = !this.isVisible;
            
            if (this.isVisible) {
                password.type = 'text';
                if (eyeIcon) eyeIcon.classList.add('d-none');
                if (eyeOffIcon) eyeOffIcon.classList.remove('d-none');
                if (togglePassword) {
                    togglePassword.setAttribute('aria-label', 'Hide password');
                    // PHASE 5: aria-pressed for toggle state
                    togglePassword.setAttribute('aria-pressed', 'true');
                }
            } else {
                password.type = 'password';
                if (eyeIcon) eyeIcon.classList.remove('d-none');
                if (eyeOffIcon) eyeOffIcon.classList.add('d-none');
                if (togglePassword) {
                    togglePassword.setAttribute('aria-label', 'Show password');
                    // PHASE 5: aria-pressed for toggle state
                    togglePassword.setAttribute('aria-pressed', 'false');
                }
            }
        }
    };

    // ==================== PHASE 4: FORM VALIDATION (PHASE 7: Enhanced) ====================
    
    /**
     * Real-time form validation with debouncing
     * @namespace FormValidation
     */
    const FormValidation = {
        // PHASE 7: Debounced validation functions
        debouncedValidateUsername: null,
        debouncedValidatePassword: null,
        
        /**
         * Initialize form validation with debouncing
         */
        init() {
            const { username, password } = UI.elements;
            
            // PHASE 7: Create debounced validators
            this.debouncedValidateUsername = debounce(() => this.validateUsername(), CONFIG.DEBOUNCE_DELAY);
            this.debouncedValidatePassword = debounce(() => this.validatePassword(true), CONFIG.DEBOUNCE_DELAY);
            
            if (username) {
                username.addEventListener('blur', () => this.validateUsername());
                username.addEventListener('input', () => {
                    this.clearValidation(username);
                    this.debouncedValidateUsername();
                });
            }
            
            if (password) {
                // Validate fully on blur
                password.addEventListener('blur', () => this.validatePassword(false));
                // Validate lightly during typing (only show error if long enough)
                password.addEventListener('input', () => {
                    this.clearValidation(password);
                    this.debouncedValidatePassword();
                });
            }
        },
        
        /**
         * Validate username field
         * @returns {boolean} True if valid
         */
        validateUsername() {
            const { username, usernameFeedback } = UI.elements;
            if (!username) return true;
            
            const value = username.value.trim();
            
            if (!value) {
                this.setInvalid(username, usernameFeedback, 'Username is required');
                return false;
            }
            
            if (!SecurityUtils.isValidUsername(value)) {
                this.setInvalid(username, usernameFeedback, 'Invalid username format. Use letters, numbers, and @/./+/-/_');
                return false;
            }
            
            this.setValid(username);
            return true;
        },
        
        /**
         * Validate password field
         * @param {boolean} isTyping - True if validation during typing, false on blur
         * @returns {boolean} True if valid
         */
        validatePassword(isTyping = false) {
            const { password, passwordFeedback } = UI.elements;
            if (!password) return true;
            
            const value = password.value;
            
            // Don't show errors while typing unless field is empty and user moved on
            if (!value) {
                if (!isTyping) {
                    this.setInvalid(password, passwordFeedback, 'Password is required');
                    return false;
                }
                return true; // Don't show error during typing if empty
            }
            
            // Only show "too short" error on blur, not while typing
            if (value.length < 4) {
                if (!isTyping) {
                    this.setInvalid(password, passwordFeedback, 'Password is too short (minimum 4 characters)');
                    return false;
                }
                return true; // Don't show error during typing if too short
            }
            
            // Clear any previous errors and mark as valid
            this.setValid(password);
            return true;
        },
        
        /**
         * Set field as invalid - PHASE 7: Cleaner implementation
         * @param {HTMLElement} field - Input element
         * @param {HTMLElement} feedback - Feedback element
         * @param {string} message - Error message
         */
        setInvalid(field, feedback, message) {
            if (!field) return;
            field.classList.remove('is-valid');
            field.classList.add('is-invalid');
            // PHASE 5: Set aria-invalid for screen readers
            field.setAttribute('aria-invalid', 'true');
            if (feedback) {
                feedback.textContent = message;
                feedback.style.display = 'block';
            }
            // Add shake animation
            field.classList.add('shake');
            setTimeout(() => field.classList.remove('shake'), 500);
        },
        
        /**
         * Set field as valid
         * @param {HTMLElement} field - Input element
         */
        setValid(field) {
            if (!field) return;
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            // PHASE 5: Set aria-invalid for screen readers
            field.setAttribute('aria-invalid', 'false');
            
            // Clear feedback message when field becomes valid
            const feedbackId = field.getAttribute('aria-describedby');
            if (feedbackId) {
                const feedbackElements = feedbackId.split(' ')
                    .map(id => $(`#${id}`))
                    .filter(el => el?.classList.contains('invalid-feedback'));
                
                feedbackElements.forEach(feedback => {
                    if (feedback) {
                        feedback.textContent = '';
                        feedback.style.display = 'none';
                    }
                });
            }
        },
        
        /**
         * Clear validation state
         * @param {HTMLElement} field - Input element
         */
        clearValidation(field) {
            if (!field) return;
            field.classList.remove('is-valid', 'is-invalid');
            // PHASE 5: Remove aria-invalid
            field.removeAttribute('aria-invalid');
        },
        
        /**
         * Validate entire form
         * @returns {boolean} True if all fields valid
         */
        validateForm() {
            const usernameValid = this.validateUsername();
            const passwordValid = this.validatePassword();
            return usernameValid && passwordValid;
        }
    };

    // ==================== PHASE 4: REMEMBER USERNAME ====================
    
    /**
     * Remember username functionality
     * @namespace RememberUsername
     */
    const RememberUsername = {
        STORAGE_KEY: 'suhuku_remembered_username',
        
        /**
         * Initialize remember username
         */
        init() {
            const { username, rememberUsername } = UI.elements;
            if (!username || !rememberUsername) return;
            
            // Load saved username
            this.load();
            
            // Save on form submit
            const { loginForm } = UI.elements;
            if (loginForm) {
                loginForm.addEventListener('submit', () => this.save());
            }
        },
        
        /**
         * Load saved username from localStorage
         */
        load() {
            const { username, rememberUsername } = UI.elements;
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved) {
                    username.value = saved;
                    rememberUsername.checked = true;
                }
            } catch (e) {
                console.warn('Unable to load saved username:', e);
            }
        },
        
        /**
         * Save username to localStorage
         */
        save() {
            const { username, rememberUsername } = UI.elements;
            try {
                if (rememberUsername.checked) {
                    localStorage.setItem(this.STORAGE_KEY, username.value.trim());
                } else {
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            } catch (e) {
                console.warn('Unable to save username:', e);
            }
        }
    };

    // ==================== PHASE 4: RESEND OTP ====================
    
    /**
     * Resend OTP functionality with cooldown
     * @namespace ResendOTP
     */
    const ResendOTP = {
        COOLDOWN: 60, // seconds
        remaining: 0,
        intervalId: null,
        
        /**
         * Initialize resend OTP functionality
         */
        init() {
            const { resendOtpBtn } = UI.elements;
            if (!resendOtpBtn) return;
            
            resendOtpBtn.addEventListener('click', () => this.resend());
            
            // Start initial cooldown
            this.startCooldown();
        },
        
        /**
         * Start cooldown timer
         */
        startCooldown() {
            const { resendOtpBtn, resendCooldown } = UI.elements;
            if (!resendOtpBtn) return;
            
            this.remaining = this.COOLDOWN;
            resendOtpBtn.disabled = true;
            
            // Toggle visibility
            const btnText = resendOtpBtn.querySelector('.btn-text');
            const btnCooldown = resendOtpBtn.querySelector('.btn-cooldown');
            if (btnText) btnText.classList.add('d-none');
            if (btnCooldown) btnCooldown.classList.remove('d-none');
            
            this.updateDisplay();
            
            this.intervalId = setInterval(() => {
                this.remaining--;
                this.updateDisplay();
                
                if (this.remaining <= 0) {
                    this.endCooldown();
                }
            }, 1000);
        },
        
        /**
         * Update cooldown display
         */
        updateDisplay() {
            const { resendCooldown } = UI.elements;
            if (resendCooldown) {
                resendCooldown.textContent = this.remaining;
            }
        },
        
        /**
         * End cooldown and enable button
         */
        endCooldown() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            
            const { resendOtpBtn } = UI.elements;
            if (!resendOtpBtn) return;
            
            resendOtpBtn.disabled = false;
            
            const btnText = resendOtpBtn.querySelector('.btn-text');
            const btnCooldown = resendOtpBtn.querySelector('.btn-cooldown');
            if (btnText) btnText.classList.remove('d-none');
            if (btnCooldown) btnCooldown.classList.add('d-none');
        },
        
        /**
         * Resend OTP (triggers page reload to get new OTP)
         */
        resend() {
            // Cleanup and reload to trigger new OTP
            API.cleanupOtpSession();
            
            // Show loading
            const { resendOtpBtn } = UI.elements;
            if (resendOtpBtn) {
                resendOtpBtn.disabled = true;
                resendOtpBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Sending...';
            }
            
            // Reload page to trigger new login + OTP
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    };

    // ==================== PHASE 4: BUTTON LOADING STATE ====================
    
    /**
     * Button loading state manager
     * @namespace ButtonLoader
     */
    const ButtonLoader = {
        /**
         * Set button to loading state
         * @param {HTMLElement} button - Button element
         */
        setLoading(button) {
            if (!button) return;
            button.disabled = true;
            button.classList.add('loading');
            // PHASE 5: Announce loading state
            const { loginStatus } = UI.elements;
            if (loginStatus) loginStatus.textContent = 'Logging in, please wait...';
        },
        
        /**
         * Remove loading state from button
         * @param {HTMLElement} button - Button element
         */
        removeLoading(button) {
            if (!button) return;
            button.disabled = false;
            button.classList.remove('loading');
            const { loginStatus } = UI.elements;
            if (loginStatus) loginStatus.textContent = '';
        }
    };

    // ==================== PHASE 5: ACCESSIBILITY MODULE ====================
    
    /**
     * Accessibility utilities and helpers
     * @namespace A11y
     */
    const A11y = {
        /**
         * Announce message to screen readers via live region
         * @param {string} message - Message to announce
         * @param {string} regionId - ID of the live region element
         */
        announce(message, regionId = 'loginStatus') {
            const region = document.getElementById(regionId);
            if (region) {
                region.textContent = message;
                // Clear after announcement
                setTimeout(() => {
                    region.textContent = '';
                }, 1000);
            }
        },
        
        /**
         * Trap focus within a modal
         * @param {HTMLElement} modal - Modal element
         */
        trapFocus(modal) {
            if (!modal) return;
            
            const focusableElements = modal.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length === 0) return;
            
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            
            modal.addEventListener('keydown', (e) => {
                if (e.key !== 'Tab') return;
                
                if (e.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            });
        },
        
        /**
         * Move focus to the first invalid field
         */
        focusFirstInvalid() {
            const invalidField = document.querySelector('[aria-invalid="true"]');
            if (invalidField) {
                invalidField.focus();
            }
        },
        
        /**
         * Initialize keyboard navigation enhancements
         */
        initKeyboardNav() {
            // Handle Escape key to close modals
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const openModal = document.querySelector('.modal.show');
                    if (openModal && !openModal.dataset.bsBackdrop === 'static') {
                        ModalManager.hide(openModal.id);
                    }
                }
            });
            
            // Enter key on OTP input
            const { otpInput } = UI.elements;
            if (otpInput) {
                otpInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        UI.elements.verifyBtn?.click();
                    }
                });
            }
        },
        
        /**
         * Check if user prefers reduced motion
         * @returns {boolean}
         */
        prefersReducedMotion() {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        },
        
        /**
         * Initialize accessibility features
         */
        init() {
            this.initKeyboardNav();
            
            // Setup focus trap for OTP modal
            const { otpModal } = UI.elements;
            if (otpModal) {
                this.trapFocus(otpModal);
                
                // Focus OTP input when modal opens
                otpModal.addEventListener('shown.bs.modal', () => {
                    UI.elements.otpInput?.focus();
                });
            }
            
            // Disable animations if user prefers reduced motion
            if (this.prefersReducedMotion()) {
                document.documentElement.classList.add('reduce-motion');
            }
        }
    };

    // ==================== PHASE 6: ERROR HANDLING MODULE ====================
    
    /**
     * Centralized error handling and logging
     * @namespace ErrorHandler
     */
    const ErrorHandler = {
        // Error types for categorization
        ErrorTypes: {
            NETWORK: 'network',
            VALIDATION: 'validation',
            AUTH: 'authentication',
            TIMEOUT: 'timeout',
            SERVER: 'server',
            UNKNOWN: 'unknown'
        },
        
        // Error messages mapping
        messages: {
            network: 'Unable to connect. Please check your internet connection.',
            validation: 'Please check your input and try again.',
            authentication: 'Authentication failed. Please try again.',
            timeout: 'Request timed out. Please try again.',
            server: 'Server error. Please try again later.',
            unknown: 'An unexpected error occurred. Please try again.',
            offline: 'You appear to be offline. Please check your connection.',
            rateLimit: 'Too many attempts. Please wait before trying again.'
        },
        
        /**
         * Log error for debugging/monitoring
         * @param {Error} error - Error object
         * @param {string} context - Where the error occurred
         * @param {Object} metadata - Additional data
         */
        log(error, context = 'unknown', metadata = {}) {
            const errorData = {
                timestamp: new Date().toISOString(),
                context,
                message: error.message || String(error),
                stack: error.stack,
                type: this.categorizeError(error),
                userAgent: navigator.userAgent,
                url: window.location.href,
                online: navigator.onLine,
                ...metadata
            };
            
            // Console logging for development
            console.error(`[LoginApp Error - ${context}]`, errorData);
            
            // Could be extended to send to error tracking service
            // this.sendToErrorService(errorData);
        },
        
        /**
         * Categorize error by type
         * @param {Error} error - Error object
         * @returns {string} Error type
         */
        categorizeError(error) {
            if (!navigator.onLine) {
                return this.ErrorTypes.NETWORK;
            }
            
            if (error.name === 'AbortError' || error.message?.includes('timeout')) {
                return this.ErrorTypes.TIMEOUT;
            }
            
            if (error.name === 'TypeError' && error.message?.includes('fetch')) {
                return this.ErrorTypes.NETWORK;
            }
            
            if (error.status >= 500) {
                return this.ErrorTypes.SERVER;
            }
            
            if (error.status === 401 || error.status === 403) {
                return this.ErrorTypes.AUTH;
            }
            
            if (error.status === 400 || error.status === 422) {
                return this.ErrorTypes.VALIDATION;
            }
            
            return this.ErrorTypes.UNKNOWN;
        },
        
        /**
         * Get user-friendly message for error
         * @param {Error} error - Error object
         * @returns {string} User-friendly message
         */
        getUserMessage(error) {
            const type = this.categorizeError(error);
            return this.messages[type] || this.messages.unknown;
        },
        
        /**
         * Handle error with UI feedback
         * @param {Error} error - Error object
         * @param {string} context - Error context
         * @param {Function} showError - Function to display error
         */
        handle(error, context, showError = UI.showOtpError.bind(UI)) {
            this.log(error, context);
            const message = this.getUserMessage(error);
            showError(message);
            
            // Announce to screen readers
            A11y.announce(message, 'loginStatus');
        },
        
        /**
         * Create custom error with additional properties
         * @param {string} message - Error message
         * @param {string} type - Error type
         * @param {number} status - HTTP status code
         * @returns {Error}
         */
        createError(message, type = 'unknown', status = null) {
            const error = new Error(message);
            error.type = type;
            error.status = status;
            return error;
        }
    };

    // ==================== PHASE 6: NETWORK STATUS MODULE ====================
    
    /**
     * Network connectivity monitoring
     * @namespace NetworkStatus
     */
    const NetworkStatus = {
        isOnline: navigator.onLine,
        listeners: [],
        checkInterval: null,
        
        /**
         * Initialize network monitoring
         */
        init() {
            // Listen to browser online/offline events
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
            
            // Initial state
            this.isOnline = navigator.onLine;
            if (!this.isOnline) {
                this.showOfflineBanner();
            }
        },
        
        /**
         * Handle coming online
         */
        handleOnline() {
            this.isOnline = true;
            this.hideOfflineBanner();
            A11y.announce('You are back online');
            this.notifyListeners(true);
        },
        
        /**
         * Handle going offline
         */
        handleOffline() {
            this.isOnline = false;
            this.showOfflineBanner();
            A11y.announce('You are offline. Some features may not work.');
            this.notifyListeners(false);
        },
        
        /**
         * Show offline notification banner
         */
        showOfflineBanner() {
            let banner = document.getElementById('offlineBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'offlineBanner';
                banner.className = 'offline-banner';
                banner.setAttribute('role', 'alert');
                banner.setAttribute('aria-live', 'assertive');
                banner.innerHTML = `
                    <span class="offline-banner__icon" aria-hidden="true">📶</span>
                    <span class="offline-banner__text">You are offline. Please check your connection.</span>
                    <button type="button" class="offline-banner__retry" onclick="window.location.reload()">
                        Retry
                    </button>
                `;
                document.body.insertBefore(banner, document.body.firstChild);
            }
            banner.classList.add('show');
        },
        
        /**
         * Hide offline notification banner
         */
        hideOfflineBanner() {
            const banner = document.getElementById('offlineBanner');
            if (banner) {
                banner.classList.remove('show');
            }
        },
        
        /**
         * Add listener for network status changes
         * @param {Function} callback - Callback function(isOnline)
         */
        addListener(callback) {
            this.listeners.push(callback);
        },
        
        /**
         * Notify all listeners of status change
         * @param {boolean} isOnline - Current online status
         */
        notifyListeners(isOnline) {
            this.listeners.forEach(callback => {
                try {
                    callback(isOnline);
                } catch (e) {
                    ErrorHandler.log(e, 'NetworkStatus.notifyListeners');
                }
            });
        },
        
        /**
         * Check if online before making request
         * @throws {Error} If offline
         */
        requireOnline() {
            if (!this.isOnline) {
                throw ErrorHandler.createError(
                    ErrorHandler.messages.offline,
                    ErrorHandler.ErrorTypes.NETWORK
                );
            }
        }
    };

    // ==================== PHASE 6: RETRY LOGIC MODULE ====================
    
    /**
     * Retry logic with exponential backoff
     * @namespace RetryHandler
     */
    const RetryHandler = {
        /**
         * Execute function with retry logic
         * @param {Function} fn - Async function to execute
         * @param {Object} options - Retry options
         * @returns {Promise} Result of function
         */
        async withRetry(fn, options = {}) {
            const {
                maxAttempts = CONFIG.MAX_RETRY_ATTEMPTS,
                delay = CONFIG.RETRY_DELAY,
                multiplier = CONFIG.RETRY_MULTIPLIER,
                shouldRetry = (error) => this.isRetryable(error),
                onRetry = null
            } = options;
            
            let lastError;
            let currentDelay = delay;
            
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    // Check network before attempt
                    NetworkStatus.requireOnline();
                    
                    return await fn();
                } catch (error) {
                    lastError = error;
                    
                    // Log the attempt
                    ErrorHandler.log(error, `RetryHandler.attempt_${attempt}`, {
                        attempt,
                        maxAttempts,
                        willRetry: attempt < maxAttempts && shouldRetry(error)
                    });
                    
                    // Check if we should retry
                    if (attempt >= maxAttempts || !shouldRetry(error)) {
                        throw error;
                    }
                    
                    // Notify about retry
                    if (onRetry) {
                        onRetry(attempt, currentDelay, error);
                    }
                    
                    // Wait before next attempt
                    await this.wait(currentDelay);
                    
                    // Exponential backoff
                    currentDelay *= multiplier;
                }
            }
            
            throw lastError;
        },
        
        /**
         * Check if error is retryable
         * @param {Error} error - Error to check
         * @returns {boolean} True if should retry
         */
        isRetryable(error) {
            // Don't retry validation errors
            if (error.status === 400 || error.status === 422) {
                return false;
            }
            
            // Don't retry auth errors
            if (error.status === 401 || error.status === 403) {
                return false;
            }
            
            // Retry network and timeout errors
            const type = ErrorHandler.categorizeError(error);
            return [
                ErrorHandler.ErrorTypes.NETWORK,
                ErrorHandler.ErrorTypes.TIMEOUT,
                ErrorHandler.ErrorTypes.SERVER
            ].includes(type);
        },
        
        /**
         * Wait for specified milliseconds
         * @param {number} ms - Milliseconds to wait
         * @returns {Promise}
         */
        wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    // ==================== PHASE 6: FETCH WITH TIMEOUT ====================
    
    /**
     * Enhanced fetch with timeout and error handling
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Response>}
     */
    async function fetchWithTimeout(url, options = {}, timeout = CONFIG.REQUEST_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const error = ErrorHandler.createError(
                    `HTTP ${response.status}: ${response.statusText}`,
                    ErrorHandler.categorizeError({ status: response.status }),
                    response.status
                );
                throw error;
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw ErrorHandler.createError(
                    'Request timed out',
                    ErrorHandler.ErrorTypes.TIMEOUT
                );
            }
            
            throw error;
        }
    }

    // ==================== API MODULE ====================
    
    /**
     * API communication functions with error handling
     * @namespace API
     */
    const API = {
        urls: {
            verifyOtp: null,
            cleanupOtpSession: null
        },

        /**
         * Set API URLs (called from template)
         * @param {Object} urls - URL configuration
         */
        setUrls(urls) {
            this.urls = { ...this.urls, ...urls };
        },

        /**
         * Verify OTP code with retry logic
         * @param {string} otp - OTP code
         * @returns {Promise<Object>} Response data
         */
        async verifyOtp(otp) {
            // PHASE 6: Use retry logic with enhanced error handling
            return RetryHandler.withRetry(
                async () => {
                    const response = await fetchWithTimeout(this.urls.verifyOtp, {
                        method: 'POST',
                        body: createFormData({ otp }),
                        credentials: 'same-origin',
                        headers: { 'X-CSRFToken': getCSRFToken() }
                    });
                    
                    return response.json();
                },
                {
                    maxAttempts: 2, // Only retry once for OTP
                    onRetry: (attempt, delay) => {
                        A11y.announce(`Connection issue. Retrying... (${attempt})`);
                    }
                }
            );
        },

        /**
         * Cleanup OTP session with error handling
         */
        cleanupOtpSession() {
            const url = this.urls.cleanupOtpSession;
            if (!url) return;

            const data = createFormData();

            try {
                // Use sendBeacon for reliability during page unload
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(url, data);
                } else {
                    fetch(url, {
                        method: 'POST',
                        body: data,
                        keepalive: true
                    }).catch(error => {
                        // PHASE 6: Log but don't show to user (cleanup is background task)
                        ErrorHandler.log(error, 'API.cleanupOtpSession');
                    });
                }
            } catch (error) {
                ErrorHandler.log(error, 'API.cleanupOtpSession');
            }
        },
        
        /**
         * PHASE 6: Health check to verify server connectivity
         * @returns {Promise<boolean>}
         */
        async healthCheck() {
            try {
                const response = await fetchWithTimeout(
                    window.location.origin + '/health/',
                    { method: 'HEAD' },
                    5000 // 5 second timeout for health check
                );
                return response.ok;
            } catch {
                return false;
            }
        }
    };

    // ==================== EVENT HANDLERS ====================
    
    /**
     * Event handler functions with enhanced error handling
     * @namespace Handlers
     */
    const Handlers = {
        /**
         * Handle login form submission
         * @param {Event} e - Submit event
         */
        handleLoginSubmit(e) {
            e.preventDefault();

            try {
                const { honeypot, username, password } = UI.elements;

                // Honeypot check (bot detection)
                if (honeypot && honeypot.value) {
                    ErrorHandler.log(
                        new Error('Honeypot triggered'),
                        'Handlers.handleLoginSubmit',
                        { honeypotValue: honeypot.value }
                    );
                    ModalManager.show('loadingModal');
                    setTimeout(() => ModalManager.hide('loadingModal'), 2000);
                    return;
                }

                // PHASE 6: Check network before submission
                if (!NetworkStatus.isOnline) {
                    UI.showLoginError(ErrorHandler.messages.offline);
                    ButtonLoader.removeLoading(UI.elements.loginBtn);
                    return;
                }

                // Sanitize and validate inputs
                const usernameValue = SecurityUtils.sanitizeInput(username?.value || '');
                const passwordValue = (password?.value || '').trim();

                if (!usernameValue || !passwordValue) {
                    UI.showLoginError('Please enter all information');
                    ButtonLoader.removeLoading(UI.elements.loginBtn);
                    return;
                }

                if (!SecurityUtils.isValidUsername(usernameValue)) {
                    UI.showLoginError('Invalid username format');
                    ButtonLoader.removeLoading(UI.elements.loginBtn);
                    return;
                }

                // Update sanitized value
                if (username) username.value = usernameValue;

                // Make form inputs readonly during submission (disabled prevents form submission)
                if (username) username.readOnly = true;
                if (password) password.readOnly = true;
                if (UI.elements.rememberUsername) UI.elements.rememberUsername.disabled = true;
                if (UI.elements.loginBtn) UI.elements.loginBtn.disabled = true;

                // Form will submit with button loading state
                UI.elements.loginForm.submit();
            } catch (error) {
                ErrorHandler.handle(error, 'Handlers.handleLoginSubmit', UI.showLoginError.bind(UI));
                ButtonLoader.removeLoading(UI.elements.loginBtn);
            }
        },

        /**
         * Handle OTP verification with comprehensive error handling
         */
        async handleOtpVerification() {
            UI.hideOtpMessages();

            // PHASE 6: Check network first
            if (!NetworkStatus.isOnline) {
                UI.showOtpError(ErrorHandler.messages.offline);
                return;
            }

            // Check rate limiting
            if (RateLimiter.isLocked()) {
                UI.showRateLimitWarning();
                return;
            }

            const otpValue = (UI.elements.otpInput?.value || '').trim();

            if (!otpValue) {
                UI.showOtpError('Please enter OTP code');
                return;
            }

            // Validate OTP format
            if (!SecurityUtils.isValidOTP(otpValue)) {
                UI.showOtpError('OTP must be 6 digits');
                RateLimiter.recordAttempt();
                UI.updateAttemptsInfo();
                return;
            }

            UI.setVerifyButtonLoading(true);
            
            // Disable OTP input and resend button during verification
            if (UI.elements.otpInput) UI.elements.otpInput.disabled = true;
            if (UI.elements.resendOtpBtn) UI.elements.resendOtpBtn.disabled = true;

            try {
                const data = await API.verifyOtp(otpValue);

                if (data.success) {
                    OTPTimer.stop();
                    RateLimiter.reset();
                    UI.showOtpSuccess(data.message || 'OTP verified successfully!');
                    A11y.announce('Login successful. Redirecting...');
                    
                    // Keep loading state on verify button during redirect
                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/login/';
                    }, 800);
                } else {
                    // Handle unsuccessful verification
                    const locked = RateLimiter.recordAttempt();
                    UI.updateAttemptsInfo();

                    if (locked) {
                        UI.showRateLimitWarning();
                        A11y.announce('Too many failed attempts. Please wait.');
                    } else {
                        const errorMsg = data.message || 'OTP code is incorrect, try again';
                        UI.showOtpError(errorMsg);
                        // PHASE 6: Shake the input for visual feedback
                        UI.elements.otpInput?.classList.add('shake');
                        setTimeout(() => {
                            UI.elements.otpInput?.classList.remove('shake');
                        }, 500);
                    }
                    UI.setVerifyButtonLoading(false);
                    
                    // Re-enable inputs for retry
                    if (UI.elements.otpInput) UI.elements.otpInput.disabled = false;
                    if (UI.elements.resendOtpBtn && !RateLimiter.isLocked()) {
                        UI.elements.resendOtpBtn.disabled = false;
                    }
                }
            } catch (error) {
                // PHASE 6: Enhanced error handling
                ErrorHandler.log(error, 'Handlers.handleOtpVerification');
                
                const locked = RateLimiter.recordAttempt();
                UI.updateAttemptsInfo();

                if (locked) {
                    UI.showRateLimitWarning();
                } else {
                    // Show user-friendly error message
                    const userMessage = ErrorHandler.getUserMessage(error);
                    UI.showOtpError(userMessage);
                }
                UI.setVerifyButtonLoading(false);
                
                // Re-enable inputs for retry
                if (UI.elements.otpInput) UI.elements.otpInput.disabled = false;
                if (UI.elements.resendOtpBtn && !RateLimiter.isLocked()) {
                    UI.elements.resendOtpBtn.disabled = false;
                }
            }
        },

        /**
         * Handle OTP expiration
         */
        handleOtpExpire() {
            const message = 'OTP has expired. Please login again.';
            UI.showOtpError(message);
            A11y.announce(message);
            
            if (UI.elements.verifyBtn) UI.elements.verifyBtn.disabled = true;
            if (UI.elements.otpInput) UI.elements.otpInput.disabled = true;
            if (UI.elements.resendOtpBtn) UI.elements.resendOtpBtn.disabled = false;

            setTimeout(() => {
                API.cleanupOtpSession();
                window.location.href = '/login/';
            }, 3000);
        },

        /**
         * Handle OTP input keypress
         * @param {KeyboardEvent} e - Keypress event
         */
        handleOtpKeypress(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleOtpVerification();
            }
        }
    };

    // ==================== INITIALIZATION ====================
    
    /**
     * Initialize the login application - PHASE 7: jQuery-free
     * @param {Object} options - Configuration options
     * @param {boolean} options.otpRequired - Whether OTP is required
     * @param {Object} options.urls - API URLs
     */
    function init(options = {}) {
        const { otpRequired = false, urls = {} } = options;

        // Set API URLs
        API.setUrls(urls);

        // Cache DOM elements
        UI.cacheElements();

        // PHASE 7: No jQuery dependency - using native fetch with CSRF
        // CSRF token is automatically included via createFormData() and fetchWithTimeout()

        // PHASE 4: Initialize UX/UI improvements
        PasswordToggle.init();
        FormValidation.init();
        RememberUsername.init();
        
        // PHASE 5: Initialize accessibility features
        A11y.init();
        
        // PHASE 6: Initialize error handling and network monitoring
        NetworkStatus.init();
        
        // PHASE 6: Global error handler for uncaught errors
        window.addEventListener('error', (event) => {
            ErrorHandler.log(event.error || new Error(event.message), 'window.onerror', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // PHASE 6: Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            ErrorHandler.log(
                event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                'unhandledrejection'
            );
        });

        // Bind login form events
        const { loginForm, loginBtn, verifyBtn, otpInput, otpModal, otpTimer } = UI.elements;

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                // PHASE 4: Use form validation
                if (!FormValidation.validateForm()) {
                    return;
                }
                
                // PHASE 4: Set button loading state
                ButtonLoader.setLoading(loginBtn);
                
                Handlers.handleLoginSubmit(e);
            });
        }

        if (verifyBtn) {
            verifyBtn.addEventListener('click', Handlers.handleOtpVerification.bind(Handlers));
        }

        if (otpInput) {
            otpInput.addEventListener('keypress', Handlers.handleOtpKeypress.bind(Handlers));
        }

        // Handle OTP modal if required
        if (otpRequired) {
            ModalManager.show('otpModal');
            OTPTimer.start(Handlers.handleOtpExpire.bind(Handlers));
            UI.updateAttemptsInfo();
            
            // PHASE 4: Initialize Resend OTP
            ResendOTP.init();

            // Cleanup on modal close
            otpModal?.addEventListener('hidden.bs.modal', () => {
                OTPTimer.stop();
                API.cleanupOtpSession();
            }, { once: true });

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
                OTPTimer.stop();
                API.cleanupOtpSession();
            }, { once: true });
        } else {
            // Hide OTP timer if not needed
            otpTimer?.classList.add('d-none');
        }
        
        // PHASE 7: Log initialization complete
        console.info('[LoginApp] Initialized successfully', { otpRequired, version: '3.0.0' });
    }

    // ==================== PUBLIC API ====================
    
    return Object.freeze({
        init,
        // Expose modules for testing
        SecurityUtils,
        RateLimiter,
        OTPTimer,
        UI,
        API,
        CONFIG,
        // PHASE 4: New modules
        PasswordToggle,
        FormValidation,
        RememberUsername,
        ResendOTP,
        ButtonLoader,
        // PHASE 5: Accessibility module
        A11y,
        // PHASE 6: Error handling modules
        ErrorHandler,
        NetworkStatus,
        RetryHandler,
        // PHASE 7: Utility functions
        utils: Object.freeze({
            debounce,
            throttle,
            createElement,
            safeJsonParse,
            isNullish
        })
    });

})();

// PHASE 7: Export for ES modules (optional)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginApp;
}

// ==================== AUTO-INITIALIZATION ====================

/**
 * Auto-initialize LoginApp when DOM is ready
 * Reads configuration from <script id="login-config"> element
 */
(function autoInit() {
    'use strict';
    
    /**
     * Load configuration from JSON script tag
     * @returns {Object|null} Configuration object or null
     */
    function loadConfig() {
        const configElement = document.getElementById('login-config');
        if (!configElement) {
            console.warn('LoginApp: Configuration element not found');
            return null;
        }
        
        try {
            return JSON.parse(configElement.textContent);
        } catch (error) {
            console.error('LoginApp: Failed to parse configuration', error);
            return null;
        }
    }
    
    /**
     * Initialize the app when DOM is ready
     */
    function init() {
        const config = loadConfig();
        if (config && typeof LoginApp !== 'undefined') {
            LoginApp.init(config);
        }
    }
    
    // Initialize based on document ready state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }
})();
