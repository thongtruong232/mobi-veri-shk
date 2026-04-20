/**
 * Error Handler Module
 * Phase 5: Security & Error Handling
 * 
 * Provides centralized error handling including:
 * - Standardized error types and codes
 * - Global error boundary
 * - Retry mechanisms
 * - User-friendly error messages
 * - Error logging and reporting
 * - Integration with StateManager
 * 
 * @module ErrorHandler
 * @version 1.0.0
 */

'use strict';

const ErrorHandler = (function() {
    // ==================== Error Types & Codes ====================
    
    const ErrorTypes = {
        NETWORK: 'NETWORK_ERROR',
        API: 'API_ERROR',
        VALIDATION: 'VALIDATION_ERROR',
        AUTH: 'AUTH_ERROR',
        TIMEOUT: 'TIMEOUT_ERROR',
        PARSE: 'PARSE_ERROR',
        PERMISSION: 'PERMISSION_ERROR',
        NOT_FOUND: 'NOT_FOUND_ERROR',
        RATE_LIMIT: 'RATE_LIMIT_ERROR',
        SERVER: 'SERVER_ERROR',
        CLIENT: 'CLIENT_ERROR',
        UNKNOWN: 'UNKNOWN_ERROR'
    };

    const ErrorCodes = {
        // Network errors (1xxx)
        NETWORK_OFFLINE: 1001,
        NETWORK_TIMEOUT: 1002,
        NETWORK_ABORT: 1003,
        
        // API errors (2xxx)
        API_BAD_REQUEST: 2400,
        API_UNAUTHORIZED: 2401,
        API_FORBIDDEN: 2403,
        API_NOT_FOUND: 2404,
        API_METHOD_NOT_ALLOWED: 2405,
        API_CONFLICT: 2409,
        API_UNPROCESSABLE: 2422,
        API_RATE_LIMITED: 2429,
        API_SERVER_ERROR: 2500,
        API_BAD_GATEWAY: 2502,
        API_SERVICE_UNAVAILABLE: 2503,
        API_GATEWAY_TIMEOUT: 2504,
        
        // Client errors (3xxx)
        CLIENT_PARSE_ERROR: 3001,
        CLIENT_VALIDATION_ERROR: 3002,
        CLIENT_SCRIPT_ERROR: 3003,
        
        // Unknown (9xxx)
        UNKNOWN: 9999
    };

    // Vietnamese error messages
    const ErrorMessages = {
        [ErrorTypes.NETWORK]: {
            default: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.',
            offline: 'Bạn đang offline. Vui lòng kiểm tra kết nối internet.',
            timeout: 'Yêu cầu đã quá thời gian chờ. Vui lòng thử lại.'
        },
        [ErrorTypes.API]: {
            default: 'Có lỗi xảy ra khi xử lý yêu cầu.',
            400: 'Yêu cầu không hợp lệ.',
            401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            403: 'Bạn không có quyền thực hiện hành động này.',
            404: 'Không tìm thấy dữ liệu yêu cầu.',
            409: 'Dữ liệu đã bị thay đổi bởi người khác. Vui lòng tải lại trang.',
            422: 'Dữ liệu gửi lên không hợp lệ.',
            429: 'Quá nhiều yêu cầu. Vui lòng đợi một lúc rồi thử lại.',
            500: 'Lỗi máy chủ. Vui lòng thử lại sau.',
            502: 'Máy chủ tạm thời không khả dụng.',
            503: 'Dịch vụ đang bảo trì. Vui lòng thử lại sau.',
            504: 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.'
        },
        [ErrorTypes.VALIDATION]: {
            default: 'Dữ liệu nhập vào không hợp lệ.',
            required: 'Trường này là bắt buộc.',
            email: 'Email không hợp lệ.',
            minLength: 'Dữ liệu quá ngắn.',
            maxLength: 'Dữ liệu quá dài.',
            pattern: 'Định dạng không hợp lệ.'
        },
        [ErrorTypes.AUTH]: {
            default: 'Lỗi xác thực. Vui lòng đăng nhập lại.',
            expired: 'Phiên đăng nhập đã hết hạn.',
            invalid: 'Thông tin đăng nhập không hợp lệ.'
        },
        [ErrorTypes.PARSE]: {
            default: 'Không thể xử lý dữ liệu từ máy chủ.'
        },
        [ErrorTypes.PERMISSION]: {
            default: 'Bạn không có quyền thực hiện hành động này.'
        },
        [ErrorTypes.NOT_FOUND]: {
            default: 'Không tìm thấy dữ liệu.'
        },
        [ErrorTypes.RATE_LIMIT]: {
            default: 'Quá nhiều yêu cầu. Vui lòng đợi một lúc.'
        },
        [ErrorTypes.SERVER]: {
            default: 'Lỗi máy chủ. Vui lòng thử lại sau.'
        },
        [ErrorTypes.UNKNOWN]: {
            default: 'Đã có lỗi xảy ra. Vui lòng thử lại.'
        }
    };

    // ==================== Custom Error Class ====================

    class AppError extends Error {
        constructor(message, type = ErrorTypes.UNKNOWN, code = ErrorCodes.UNKNOWN, details = {}) {
            super(message);
            this.name = 'AppError';
            this.type = type;
            this.code = code;
            this.details = details;
            this.timestamp = new Date().toISOString();
            this.retryable = this.isRetryable();
            
            // Capture stack trace
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, AppError);
            }
        }

        isRetryable() {
            // Network and some server errors are retryable
            const retryableCodes = [
                ErrorCodes.NETWORK_OFFLINE,
                ErrorCodes.NETWORK_TIMEOUT,
                ErrorCodes.API_SERVER_ERROR,
                ErrorCodes.API_BAD_GATEWAY,
                ErrorCodes.API_SERVICE_UNAVAILABLE,
                ErrorCodes.API_GATEWAY_TIMEOUT
            ];
            return retryableCodes.includes(this.code);
        }

        toJSON() {
            return {
                name: this.name,
                message: this.message,
                type: this.type,
                code: this.code,
                details: this.details,
                timestamp: this.timestamp,
                retryable: this.retryable
            };
        }

        getUserMessage() {
            return getErrorMessage(this.type, this.details.statusCode || 'default');
        }
    }

    // ==================== Error Factory ====================

    /**
     * Create error from HTTP response
     */
    function fromHttpResponse(response, responseData = null) {
        const status = response.status;
        const statusText = response.statusText;
        
        let type = ErrorTypes.API;
        let code = 2000 + status;
        
        // Determine error type from status
        if (status === 401) {
            type = ErrorTypes.AUTH;
        } else if (status === 403) {
            type = ErrorTypes.PERMISSION;
        } else if (status === 404) {
            type = ErrorTypes.NOT_FOUND;
        } else if (status === 429) {
            type = ErrorTypes.RATE_LIMIT;
        } else if (status >= 500) {
            type = ErrorTypes.SERVER;
        } else if (status >= 400) {
            type = ErrorTypes.CLIENT;
        }

        const message = getErrorMessage(type, status);
        
        return new AppError(message, type, code, {
            statusCode: status,
            statusText,
            url: response.url,
            responseData
        });
    }

    /**
     * Create error from network failure
     */
    function fromNetworkError(error) {
        let type = ErrorTypes.NETWORK;
        let code = ErrorCodes.NETWORK_OFFLINE;
        let subKey = 'default';
        
        if (error.name === 'AbortError') {
            code = ErrorCodes.NETWORK_ABORT;
            type = ErrorTypes.TIMEOUT;
            subKey = 'timeout';
        } else if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
            code = ErrorCodes.NETWORK_TIMEOUT;
            type = ErrorTypes.TIMEOUT;
            subKey = 'timeout';
        } else if (!navigator.onLine) {
            subKey = 'offline';
        }

        const message = ErrorMessages[ErrorTypes.NETWORK][subKey];
        
        return new AppError(message, type, code, {
            originalError: error.message,
            offline: !navigator.onLine
        });
    }

    /**
     * Create validation error
     */
    function fromValidation(field, rule, message = null) {
        const defaultMessage = ErrorMessages[ErrorTypes.VALIDATION][rule] || 
                              ErrorMessages[ErrorTypes.VALIDATION].default;
        
        return new AppError(
            message || defaultMessage,
            ErrorTypes.VALIDATION,
            ErrorCodes.CLIENT_VALIDATION_ERROR,
            { field, rule }
        );
    }

    /**
     * Create parse error
     */
    function fromParseError(error) {
        return new AppError(
            ErrorMessages[ErrorTypes.PARSE].default,
            ErrorTypes.PARSE,
            ErrorCodes.CLIENT_PARSE_ERROR,
            { originalError: error.message }
        );
    }

    // ==================== Error Message Helpers ====================

    /**
     * Get user-friendly error message
     */
    function getErrorMessage(type, key = 'default') {
        const typeMessages = ErrorMessages[type] || ErrorMessages[ErrorTypes.UNKNOWN];
        return typeMessages[key] || typeMessages.default;
    }

    // ==================== Retry Mechanism ====================

    const DEFAULT_RETRY_CONFIG = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableErrors: [
            ErrorTypes.NETWORK,
            ErrorTypes.TIMEOUT,
            ErrorTypes.SERVER
        ]
    };

    /**
     * Execute function with retry logic
     */
    async function withRetry(fn, options = {}) {
        const config = { ...DEFAULT_RETRY_CONFIG, ...options };
        let lastError;
        
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                return await fn(attempt);
            } catch (error) {
                lastError = error instanceof AppError ? error : new AppError(
                    error.message,
                    ErrorTypes.UNKNOWN,
                    ErrorCodes.UNKNOWN,
                    { originalError: error }
                );

                // Check if error is retryable
                if (!config.retryableErrors.includes(lastError.type) || 
                    attempt === config.maxRetries) {
                    throw lastError;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
                    config.maxDelay
                );

                console.log(`[ErrorHandler] Retry ${attempt + 1}/${config.maxRetries} after ${delay}ms`);
                await sleep(delay);
            }
        }

        throw lastError;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== Global Error Handler ====================

    let globalErrorCallback = null;
    let errorLog = [];
    const MAX_ERROR_LOG = 100;

    /**
     * Set global error callback
     */
    function setGlobalErrorCallback(callback) {
        globalErrorCallback = callback;
    }

    /**
     * Handle error globally
     */
    function handleError(error, context = {}) {
        const appError = error instanceof AppError ? error : new AppError(
            error.message || 'Unknown error',
            ErrorTypes.UNKNOWN,
            ErrorCodes.UNKNOWN,
            { originalError: error, ...context }
        );

        // Log error
        logError(appError, context);

        // Call global callback if set
        if (globalErrorCallback) {
            try {
                globalErrorCallback(appError, context);
            } catch (callbackError) {
                console.error('[ErrorHandler] Error in global callback:', callbackError);
            }
        }

        // Update StateManager if available
        if (typeof StateManager !== 'undefined' && StateManager.actions?.setError) {
            StateManager.actions.setError(appError.getUserMessage());
        }

        // Show user notification if UIHelpers available
        if (typeof UIHelpers !== 'undefined' && UIHelpers.showToast) {
            const toastType = appError.type === ErrorTypes.AUTH ? 'warning' : 'error';
            UIHelpers.showToast(appError.getUserMessage(), toastType);
        }

        return appError;
    }

    /**
     * Log error for debugging
     */
    function logError(error, context = {}) {
        const logEntry = {
            error: error instanceof AppError ? error.toJSON() : {
                message: error.message,
                name: error.name,
                stack: error.stack
            },
            context,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Add to in-memory log
        errorLog.unshift(logEntry);
        if (errorLog.length > MAX_ERROR_LOG) {
            errorLog.pop();
        }

        // Console log in development
        console.error('[ErrorHandler]', logEntry);

        // Could send to server for production logging
        // sendToServer(logEntry);
    }

    /**
     * Get error log
     */
    function getErrorLog() {
        return [...errorLog];
    }

    /**
     * Clear error log
     */
    function clearErrorLog() {
        errorLog = [];
    }

    // ==================== Global Error Listeners ====================

    /**
     * Initialize global error listeners
     */
    function initGlobalListeners() {
        // Catch unhandled errors
        window.addEventListener('error', (event) => {
            handleError(new AppError(
                event.message || 'Script error',
                ErrorTypes.CLIENT,
                ErrorCodes.CLIENT_SCRIPT_ERROR,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            ), { source: 'window.onerror' });
        });

        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            handleError(error, { source: 'unhandledrejection' });
        });

        // Network status changes
        window.addEventListener('online', () => {
            if (typeof UIHelpers !== 'undefined' && UIHelpers.showToast) {
                UIHelpers.showToast('Đã kết nối lại internet', 'success');
            }
            if (typeof StateManager !== 'undefined') {
                StateManager.actions?.clearError?.();
            }
        });

        window.addEventListener('offline', () => {
            handleError(new AppError(
                ErrorMessages[ErrorTypes.NETWORK].offline,
                ErrorTypes.NETWORK,
                ErrorCodes.NETWORK_OFFLINE
            ), { source: 'offline' });
        });

        console.log('[ErrorHandler] Global listeners initialized');
    }

    // ==================== Error Boundary for Async Operations ====================

    /**
     * Wrap async function with error handling
     */
    function wrapAsync(fn, context = {}) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                handleError(error, { ...context, args });
                throw error; // Re-throw for caller to handle if needed
            }
        };
    }

    /**
     * Safe wrapper that doesn't throw
     */
    function safeTry(fn, defaultValue = null, context = {}) {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                handleError(error, { ...context, args });
                return defaultValue;
            }
        };
    }

    // ==================== Public API ====================
    return {
        // Error Types and Codes
        Types: ErrorTypes,
        Codes: ErrorCodes,
        
        // Custom Error Class
        AppError,
        
        // Error Factory
        fromHttpResponse,
        fromNetworkError,
        fromValidation,
        fromParseError,
        
        // Error Messages
        getErrorMessage,
        Messages: ErrorMessages,
        
        // Retry Mechanism
        withRetry,
        
        // Global Error Handling
        setGlobalErrorCallback,
        handleError,
        logError,
        getErrorLog,
        clearErrorLog,
        
        // Global Listeners
        initGlobalListeners,
        
        // Wrappers
        wrapAsync,
        safeTry
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
window.ErrorHandler = ErrorHandler;
