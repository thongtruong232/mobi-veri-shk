/**
 * Form Validator Module
 * Phase 5: Security & Error Handling
 * 
 * Provides comprehensive form validation including:
 * - Field validation rules
 * - Real-time validation
 * - Error message display
 * - Form submission handling
 * - Input sanitization integration
 * 
 * @module FormValidator
 * @version 1.0.0
 */

'use strict';

const FormValidator = (function() {
    // ==================== Configuration ====================
    
    const CONFIG = {
        errorClass: 'is-invalid',
        successClass: 'is-valid',
        errorMessageClass: 'invalid-feedback',
        validateOnBlur: true,
        validateOnInput: true,
        debounceMs: 300
    };

    // Built-in validation rules
    const RULES = {
        required: {
            validate: (value) => value !== null && value !== undefined && String(value).trim() !== '',
            message: 'Trường này là bắt buộc'
        },
        email: {
            validate: (value) => {
                if (!value) return true; // Let required handle empty
                return typeof Security !== 'undefined' 
                    ? Security.isValidEmail(value) 
                    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: 'Email không hợp lệ'
        },
        url: {
            validate: (value) => {
                if (!value) return true;
                return typeof Security !== 'undefined'
                    ? Security.isValidUrl(value)
                    : /^https?:\/\/.+/.test(value);
            },
            message: 'URL không hợp lệ'
        },
        minLength: {
            validate: (value, param) => {
                if (!value) return true;
                return String(value).length >= parseInt(param);
            },
            message: (param) => `Tối thiểu ${param} ký tự`
        },
        maxLength: {
            validate: (value, param) => {
                if (!value) return true;
                return String(value).length <= parseInt(param);
            },
            message: (param) => `Tối đa ${param} ký tự`
        },
        min: {
            validate: (value, param) => {
                if (value === '' || value === null) return true;
                return parseFloat(value) >= parseFloat(param);
            },
            message: (param) => `Giá trị tối thiểu là ${param}`
        },
        max: {
            validate: (value, param) => {
                if (value === '' || value === null) return true;
                return parseFloat(value) <= parseFloat(param);
            },
            message: (param) => `Giá trị tối đa là ${param}`
        },
        pattern: {
            validate: (value, param) => {
                if (!value) return true;
                const regex = new RegExp(param);
                return regex.test(value);
            },
            message: 'Định dạng không hợp lệ'
        },
        numeric: {
            validate: (value) => {
                if (!value) return true;
                return /^-?\d*\.?\d+$/.test(value);
            },
            message: 'Chỉ được nhập số'
        },
        integer: {
            validate: (value) => {
                if (!value) return true;
                return /^-?\d+$/.test(value);
            },
            message: 'Chỉ được nhập số nguyên'
        },
        alphanumeric: {
            validate: (value) => {
                if (!value) return true;
                return /^[a-zA-Z0-9]+$/.test(value);
            },
            message: 'Chỉ được nhập chữ và số'
        },
        phone: {
            validate: (value) => {
                if (!value) return true;
                return /^[0-9+\-\s()]{8,20}$/.test(value);
            },
            message: 'Số điện thoại không hợp lệ'
        },
        match: {
            validate: (value, param, formData) => {
                if (!value) return true;
                return value === formData[param];
            },
            message: (param) => `Không khớp với trường ${param}`
        },
        noXss: {
            validate: (value) => {
                if (!value) return true;
                const dangerous = /<script|javascript:|on\w+=/i;
                return !dangerous.test(value);
            },
            message: 'Nội dung không hợp lệ'
        }
    };

    // Store for form validators
    const validators = new Map();
    const customRules = new Map();

    // ==================== Validator Class ====================

    class Validator {
        constructor(form, options = {}) {
            this.form = typeof form === 'string' ? document.querySelector(form) : form;
            if (!this.form) {
                throw new Error('Form element not found');
            }

            this.options = { ...CONFIG, ...options };
            this.fields = new Map();
            this.errors = new Map();
            this.touched = new Set();
            this.debounceTimers = new Map();

            this.init();
        }

        init() {
            // Setup event listeners
            if (this.options.validateOnBlur) {
                this.form.addEventListener('focusout', this.handleBlur.bind(this));
            }
            if (this.options.validateOnInput) {
                this.form.addEventListener('input', this.handleInput.bind(this));
            }

            // Intercept form submission
            this.form.addEventListener('submit', this.handleSubmit.bind(this));

            // Parse data attributes for validation rules
            this.parseDataAttributes();
        }

        parseDataAttributes() {
            const inputs = this.form.querySelectorAll('[data-validate]');
            inputs.forEach(input => {
                const rules = this.parseRules(input.dataset.validate);
                const name = input.name || input.id;
                if (name && rules.length > 0) {
                    this.addField(name, rules, input.dataset.validateMessage);
                }
            });
        }

        parseRules(ruleString) {
            if (!ruleString) return [];
            
            return ruleString.split('|').map(rule => {
                const [name, param] = rule.split(':');
                return { name: name.trim(), param: param?.trim() };
            });
        }

        addField(name, rules, customMessage = null) {
            if (typeof rules === 'string') {
                rules = this.parseRules(rules);
            }
            this.fields.set(name, { rules, customMessage });
            return this;
        }

        removeField(name) {
            this.fields.delete(name);
            this.errors.delete(name);
            return this;
        }

        handleBlur(event) {
            const input = event.target;
            const name = input.name || input.id;
            if (name && this.fields.has(name)) {
                this.touched.add(name);
                this.validateField(name);
            }
        }

        handleInput(event) {
            const input = event.target;
            const name = input.name || input.id;
            if (name && this.fields.has(name) && this.touched.has(name)) {
                // Debounce validation
                if (this.debounceTimers.has(name)) {
                    clearTimeout(this.debounceTimers.get(name));
                }
                this.debounceTimers.set(name, setTimeout(() => {
                    this.validateField(name);
                }, this.options.debounceMs));
            }
        }

        handleSubmit(event) {
            // Mark all fields as touched
            this.fields.forEach((_, name) => this.touched.add(name));
            
            // Validate all fields
            const isValid = this.validateAll();
            
            if (!isValid) {
                event.preventDefault();
                event.stopPropagation();
                
                // Focus first error field
                const firstError = this.errors.keys().next().value;
                if (firstError) {
                    const input = this.getInput(firstError);
                    if (input) input.focus();
                }

                // Trigger error callback if set
                if (this.options.onError) {
                    this.options.onError(this.getErrors());
                }
            } else if (this.options.onSuccess) {
                event.preventDefault();
                this.options.onSuccess(this.getFormData());
            }
        }

        getInput(name) {
            return this.form.querySelector(`[name="${name}"]`) || 
                   this.form.querySelector(`#${name}`);
        }

        getValue(name) {
            const input = this.getInput(name);
            if (!input) return null;

            if (input.type === 'checkbox') {
                return input.checked;
            } else if (input.type === 'radio') {
                const checked = this.form.querySelector(`[name="${name}"]:checked`);
                return checked ? checked.value : null;
            }
            return input.value;
        }

        getFormData() {
            const data = {};
            this.fields.forEach((_, name) => {
                data[name] = this.getValue(name);
            });
            return data;
        }

        validateField(name) {
            const field = this.fields.get(name);
            if (!field) return true;

            const value = this.getValue(name);
            const formData = this.getFormData();
            const errors = [];

            for (const rule of field.rules) {
                const ruleDef = RULES[rule.name] || customRules.get(rule.name);
                if (!ruleDef) {
                    console.warn(`[FormValidator] Unknown rule: ${rule.name}`);
                    continue;
                }

                if (!ruleDef.validate(value, rule.param, formData)) {
                    const message = field.customMessage || 
                        (typeof ruleDef.message === 'function' ? ruleDef.message(rule.param) : ruleDef.message);
                    errors.push(message);
                    break; // Stop at first error
                }
            }

            if (errors.length > 0) {
                this.errors.set(name, errors);
                this.showError(name, errors[0]);
                return false;
            } else {
                this.errors.delete(name);
                this.showSuccess(name);
                return true;
            }
        }

        validateAll() {
            let isValid = true;
            this.errors.clear();

            this.fields.forEach((_, name) => {
                if (!this.validateField(name)) {
                    isValid = false;
                }
            });

            return isValid;
        }

        showError(name, message) {
            const input = this.getInput(name);
            if (!input) return;

            input.classList.remove(this.options.successClass);
            input.classList.add(this.options.errorClass);

            // Find or create error message element
            let errorEl = input.parentNode.querySelector(`.${this.options.errorMessageClass}`);
            if (!errorEl) {
                errorEl = document.createElement('div');
                errorEl.className = this.options.errorMessageClass;
                input.parentNode.appendChild(errorEl);
            }
            errorEl.textContent = message;
        }

        showSuccess(name) {
            const input = this.getInput(name);
            if (!input) return;

            input.classList.remove(this.options.errorClass);
            input.classList.add(this.options.successClass);

            // Remove error message
            const errorEl = input.parentNode.querySelector(`.${this.options.errorMessageClass}`);
            if (errorEl) {
                errorEl.remove();
            }
        }

        clearErrors() {
            this.errors.clear();
            this.touched.clear();
            
            this.fields.forEach((_, name) => {
                const input = this.getInput(name);
                if (input) {
                    input.classList.remove(this.options.errorClass, this.options.successClass);
                    const errorEl = input.parentNode.querySelector(`.${this.options.errorMessageClass}`);
                    if (errorEl) errorEl.remove();
                }
            });
        }

        getErrors() {
            const errors = {};
            this.errors.forEach((messages, name) => {
                errors[name] = messages;
            });
            return errors;
        }

        isValid() {
            return this.errors.size === 0;
        }

        reset() {
            this.form.reset();
            this.clearErrors();
        }

        destroy() {
            this.form.removeEventListener('submit', this.handleSubmit);
            this.form.removeEventListener('input', this.handleInput);
            this.form.removeEventListener('focusout', this.handleBlur);
            this.debounceTimers.forEach(timer => clearTimeout(timer));
            this.clearErrors();
        }

        // Chain-able methods for custom error handling
        onError(callback) {
            this.options.onError = callback;
            return this;
        }

        onSuccess(callback) {
            this.options.onSuccess = callback;
            return this;
        }
    }

    // ==================== Public API ====================

    /**
     * Create a new validator for a form
     * @param {string|HTMLFormElement} form - Form selector or element
     * @param {Object} options - Validator options
     * @returns {Validator} Validator instance
     */
    function create(form, options = {}) {
        const validator = new Validator(form, options);
        const formId = typeof form === 'string' ? form : (form.id || `form_${Date.now()}`);
        validators.set(formId, validator);
        return validator;
    }

    /**
     * Get existing validator by form ID
     * @param {string} formId - Form ID
     * @returns {Validator|null} Validator instance
     */
    function get(formId) {
        return validators.get(formId) || null;
    }

    /**
     * Destroy validator by form ID
     * @param {string} formId - Form ID
     */
    function destroy(formId) {
        const validator = validators.get(formId);
        if (validator) {
            validator.destroy();
            validators.delete(formId);
        }
    }

    /**
     * Add custom validation rule
     * @param {string} name - Rule name
     * @param {Function} validate - Validation function
     * @param {string|Function} message - Error message
     */
    function addRule(name, validate, message) {
        customRules.set(name, { validate, message });
    }

    /**
     * Validate a single value against rules
     * @param {*} value - Value to validate
     * @param {string|Array} rules - Rules to apply
     * @returns {Object} { valid: boolean, errors: string[] }
     */
    function validate(value, rules) {
        if (typeof rules === 'string') {
            rules = rules.split('|').map(r => {
                const [name, param] = r.split(':');
                return { name, param };
            });
        }

        const errors = [];
        for (const rule of rules) {
            const ruleDef = RULES[rule.name] || customRules.get(rule.name);
            if (!ruleDef) continue;

            if (!ruleDef.validate(value, rule.param)) {
                const msg = typeof ruleDef.message === 'function' 
                    ? ruleDef.message(rule.param) 
                    : ruleDef.message;
                errors.push(msg);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Sanitize form input value
     * @param {*} value - Value to sanitize
     * @param {string} type - Sanitization type
     * @returns {*} Sanitized value
     */
    function sanitize(value, type = 'text') {
        if (value === null || value === undefined) return '';
        
        const str = String(value).trim();
        
        switch (type) {
            case 'html':
                return typeof Security !== 'undefined' 
                    ? Security.escapeHtml(str) 
                    : str.replace(/[<>"'&]/g, '');
            case 'email':
                return str.toLowerCase().replace(/[^a-z0-9@._+-]/g, '');
            case 'number':
                return str.replace(/[^0-9.-]/g, '');
            case 'alpha':
                return str.replace(/[^a-zA-Z]/g, '');
            case 'alphanumeric':
                return str.replace(/[^a-zA-Z0-9]/g, '');
            case 'filename':
                return typeof Security !== 'undefined'
                    ? Security.sanitizeFilename(str)
                    : str.replace(/[^a-zA-Z0-9._-]/g, '_');
            default:
                return str;
        }
    }

    return {
        // Validator factory
        create,
        get,
        destroy,
        
        // Custom rules
        addRule,
        RULES,
        
        // Direct validation
        validate,
        sanitize,
        
        // Validator class for advanced usage
        Validator
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidator;
}
window.FormValidator = FormValidator;
