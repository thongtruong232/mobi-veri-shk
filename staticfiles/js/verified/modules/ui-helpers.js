/**
 * UI Helpers Module
 * Phase 6: Enhanced with accessibility and loading states
 * Provides UI-related helper functions for notifications, tooltips, and modals
 * @module UIHelpers
 */

'use strict';

const UIHelpers = (function() {
    // Cache DOM elements for performance
    let notificationPopup = null;
    let loadingOverlay = null;

    /**
     * Initialize cached elements and accessibility
     */
    function init() {
        notificationPopup = document.getElementById('notificationPopup');
        loadingOverlay = document.querySelector('.loading-overlay');
        
        // Initialize accessibility module
        if (typeof Accessibility !== 'undefined') {
            Accessibility.init();
        }
    }

    /**
     * Show a tooltip near cursor position
     * @param {string} message - Tooltip message
     * @param {Event} event - Mouse event for positioning
     * @param {boolean} success - Whether it's a success message
     * @param {number} duration - Duration in ms before auto-hide
     */
    function showTooltip(message, event, success = true, duration = 1000) {
        // Sanitize message
        const safeMessage = typeof Security !== 'undefined' 
            ? Security.escapeHtml(message) 
            : message;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip animate-fadeInUp';
        tooltip.textContent = safeMessage;
        tooltip.setAttribute('role', 'status');
        tooltip.setAttribute('aria-live', 'polite');

        if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            tooltip.style.left = `${event.clientX + 10}px`;
            tooltip.style.top = `${event.clientY - 25}px`;
        } else {
            tooltip.style.left = '50%';
            tooltip.style.top = '20px';
            tooltip.style.transform = 'translateX(-50%)';
        }

        document.body.appendChild(tooltip);
        tooltip.style.display = 'block';

        // Announce for screen readers
        if (typeof Accessibility !== 'undefined') {
            Accessibility.announce(message);
        }

        setTimeout(() => {
            tooltip.classList.add('animate-fadeOut');
            setTimeout(() => {
                if (tooltip.parentNode) {
                    document.body.removeChild(tooltip);
                }
            }, 150);
        }, duration);
    }

    /**
     * Show notification popup
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success' or 'error')
     */
    function showNotification(message, type = 'success') {
        let popup = notificationPopup || document.getElementById('notificationPopup');

        // Create popup if it doesn't exist
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'notificationPopup';
            popup.className = 'notification-popup';
            popup.style.display = 'none';
            popup.innerHTML = `
                <div class="notification-content">
                    <div class="notification-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="notification-message"></div>
                </div>`;
            document.body.appendChild(popup);
            notificationPopup = popup;
        }

        // Ensure structure exists
        const icon = popup.querySelector('.notification-icon i');
        const messageElement = popup.querySelector('.notification-message');
        
        if (!icon || !messageElement) {
            console.warn('Notification popup structure missing, skipping notification');
            return;
        }

        // Update content
        messageElement.textContent = message;

        // Update icon and styling based on type
        if (type === 'success') {
            icon.className = 'fas fa-check-circle';
            icon.parentElement.className = 'notification-icon success';
        } else {
            icon.className = 'fas fa-times-circle';
            icon.parentElement.className = 'notification-icon error';
        }

        // Show popup
        popup.style.display = 'block';
        popup.classList.remove('hide');

        // Auto-hide after 3 seconds
        setTimeout(() => {
            popup.classList.add('hide');
            setTimeout(() => {
                popup.style.display = 'none';
                popup.classList.remove('hide');
            }, 300);
        }, 3000);
    }

    /**
     * Show toast notification using Bootstrap
     * Phase 5: Enhanced with XSS protection
     * @param {string} message - Toast message
     * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
     * @param {Object} options - Additional options
     */
    function showToast(message, type = 'success', options = {}) {
        const {
            duration = 5000,
            dismissible = true,
            position = 'top-end'
        } = options;

        const bgClass = {
            'success': 'bg-success',
            'error': 'bg-danger',
            'warning': 'bg-warning',
            'info': 'bg-info'
        }[type] || 'bg-success';

        const icon = {
            'success': 'fa-check-circle',
            'error': 'fa-times-circle',
            'warning': 'fa-exclamation-triangle',
            'info': 'fa-info-circle'
        }[type] || 'fa-check-circle';

        // Sanitize message to prevent XSS
        const safeMessage = typeof Security !== 'undefined' 
            ? Security.escapeHtml(message) 
            : message.replace(/[<>"'&]/g, char => ({
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;'
            }[char]));

        const positionClasses = {
            'top-end': 'top-0 end-0',
            'top-start': 'top-0 start-0',
            'bottom-end': 'bottom-0 end-0',
            'bottom-start': 'bottom-0 start-0',
            'top-center': 'top-0 start-50 translate-middle-x'
        }[position] || 'top-0 end-0';

        const toast = document.createElement('div');
        toast.className = `position-fixed ${positionClasses} p-3`;
        toast.style.zIndex = '1055';
        toast.innerHTML = `
            <div class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${duration}">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas ${icon} me-2"></i>
                        ${safeMessage}
                    </div>
                    ${dismissible ? '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' : ''}
                </div>
            </div>
        `;
        document.body.appendChild(toast);

        const toastElement = new bootstrap.Toast(toast.querySelector('.toast'), {
            autohide: true,
            delay: duration
        });
        toastElement.show();

        // Clean up after toast is hidden
        toast.querySelector('.toast').addEventListener('hidden.bs.toast', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });

        return toastElement;
    }

    /**
     * Show loading overlay
     */
    function showLoading() {
        const overlay = loadingOverlay || document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const overlay = loadingOverlay || document.querySelector('.loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Show loading popup with cancel button
     * @param {string} message - Loading message
     * @param {Function} onCancel - Cancel callback
     * @returns {HTMLElement} Loading popup element
     */
    function showLoadingPopup(message = 'Processing request...', onCancel = null) {
        const loadingPopup = document.createElement('div');
        loadingPopup.className = 'loading-popup';
        loadingPopup.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>${message}</p>
                ${onCancel ? '<button id="cancelRequestBtn" class="cancel-btn">Cancel</button>' : ''}
            </div>
        `;
        document.body.appendChild(loadingPopup);

        if (onCancel) {
            const cancelBtn = loadingPopup.querySelector('#cancelRequestBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    onCancel();
                    removeLoadingPopup(loadingPopup);
                });
            }
        }

        return loadingPopup;
    }

    /**
     * Remove loading popup
     * @param {HTMLElement} popup - Loading popup element
     */
    function removeLoadingPopup(popup) {
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }

    /**
     * Close all custom modals
     */
    function closeAllModals() {
        const modalIds = [
            'mailListModal',
            'purchaseModal',
            'passwordModal',
            'confirmFetchModal',
            'passwordInputModal',
            'reserveMailModal',
            'importOptionsModal'
        ];

        modalIds.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
            }
        });

        document.body.style.overflow = 'auto';
    }

    /**
     * Show simple modal with message
     * @param {string} message - Modal message
     * @param {string} title - Modal title
     */
    function showModal(message, title = 'Notice') {
        const existingModal = document.getElementById('simpleAlertModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'simpleAlertModal';
        modal.className = 'modal fade show';
        modal.style.display = 'block';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${title}</h5>
                        <button type="button" class="btn-close" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto'"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="this.closest('.modal').remove(); document.body.style.overflow='auto'">OK</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    }

    /**
     * Show confirm dialog
     * @param {string} message - Confirm message
     * @param {string} title - Dialog title
     * @returns {Promise<boolean>} True if confirmed, false otherwise
     */
    function showConfirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const existingModal = document.getElementById('confirmDialogModal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'confirmDialogModal';
            modal.className = 'modal fade show';
            modal.style.display = 'block';
            modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
            modal.innerHTML = `
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" id="confirmCloseBtn"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" id="confirmCancelBtn">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmOkBtn">Confirm</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            const cleanup = () => {
                modal.remove();
                document.body.style.overflow = 'auto';
            };

            modal.querySelector('#confirmCloseBtn').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            modal.querySelector('#confirmCancelBtn').addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            modal.querySelector('#confirmOkBtn').addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
        });
    }

    /**
     * Set button to loading state
     * @param {HTMLElement} button - Button element
     * @param {string} loadingText - Loading text to show
     * @returns {Object} Object with restore function and original content
     */
    function setButtonLoading(button, loadingText = 'Processing...') {
        if (!button) return { restore: () => {} };

        const originalText = button.innerHTML;
        const originalDisabled = button.disabled;

        button.disabled = true;
        button.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            ${loadingText}
        `;

        return {
            restore: () => {
                button.disabled = originalDisabled;
                button.innerHTML = originalText;
            },
            originalText,
            originalDisabled
        };
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        init,
        showTooltip,
        showNotification,
        showToast,
        showLoading,
        hideLoading,
        showLoadingPopup,
        removeLoadingPopup,
        closeAllModals,
        showModal,
        showConfirm,
        setButtonLoading
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIHelpers;
}
window.UIHelpers = UIHelpers;
