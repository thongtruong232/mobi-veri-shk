/**
 * Accessibility Module
 * Phase 6: UI/UX Enhancements
 * 
 * Provides accessibility features including:
 * - ARIA attribute management
 * - Keyboard navigation
 * - Focus management
 * - Screen reader announcements
 * - Skip links
 * - Reduced motion support
 * 
 * @module Accessibility
 * @version 1.0.0
 */

'use strict';

const Accessibility = (function() {
    // ==================== Configuration ====================
    const CONFIG = {
        focusableSelectors: [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(', '),
        announcerDelay: 100,
        trapFocusClass: 'focus-trap-active'
    };

    // State
    let liveRegion = null;
    let focusTrapStack = [];
    let prefersReducedMotion = false;

    // ==================== Initialization ====================

    /**
     * Initialize accessibility features
     */
    function init() {
        createLiveRegion();
        detectReducedMotion();
        setupKeyboardNavigation();
        enhanceExistingElements();
        
        console.log('[Accessibility] Initialized');
    }

    /**
     * Create ARIA live region for announcements
     */
    function createLiveRegion() {
        if (liveRegion) return;

        liveRegion = document.createElement('div');
        liveRegion.id = 'aria-live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        liveRegion.style.cssText = `
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        `;
        document.body.appendChild(liveRegion);
    }

    /**
     * Detect reduced motion preference
     */
    function detectReducedMotion() {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReducedMotion = mediaQuery.matches;

        mediaQuery.addEventListener('change', (e) => {
            prefersReducedMotion = e.matches;
            document.body.classList.toggle('reduce-motion', prefersReducedMotion);
            announce(prefersReducedMotion ? 'Reduced motion enabled' : 'Animations enabled');
        });

        document.body.classList.toggle('reduce-motion', prefersReducedMotion);
    }

    /**
     * Setup global keyboard navigation
     */
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', handleGlobalKeydown);
        
        // Show focus outline only for keyboard users
        document.addEventListener('mousedown', () => {
            document.body.classList.add('using-mouse');
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.remove('using-mouse');
            }
        });
    }

    /**
     * Handle global keyboard shortcuts
     */
    function handleGlobalKeydown(event) {
        // Escape key to close modals
        if (event.key === 'Escape') {
            const activeModal = document.querySelector('.modal.show, .custom-modal[style*="block"]');
            if (activeModal) {
                const closeBtn = activeModal.querySelector('.btn-close, [data-bs-dismiss="modal"]');
                if (closeBtn) closeBtn.click();
            }
        }

        // Skip to main content with Alt+1
        if (event.altKey && event.key === '1') {
            event.preventDefault();
            const main = document.querySelector('main, [role="main"], .container-fluid');
            if (main) {
                main.setAttribute('tabindex', '-1');
                main.focus();
                announce('Skipped to main content');
            }
        }

        // Focus search with Ctrl+K or /
        if ((event.ctrlKey && event.key === 'k') || (event.key === '/' && !isInputFocused())) {
            event.preventDefault();
            const searchInput = document.querySelector('#searchDate, [type="search"], .search-input');
            if (searchInput) {
                searchInput.focus();
                announce('Search focused');
            }
        }
    }

    /**
     * Check if an input element is focused
     */
    function isInputFocused() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' || 
            active.tagName === 'TEXTAREA' || 
            active.isContentEditable
        );
    }

    /**
     * Enhance existing elements with ARIA attributes
     */
    function enhanceExistingElements() {
        // Enhance buttons without proper labels
        document.querySelectorAll('button:not([aria-label])').forEach(btn => {
            if (!btn.textContent.trim() && btn.querySelector('i, svg')) {
                const icon = btn.querySelector('i');
                if (icon) {
                    const iconClass = icon.className;
                    if (iconClass.includes('copy')) btn.setAttribute('aria-label', 'Copy');
                    else if (iconClass.includes('edit')) btn.setAttribute('aria-label', 'Edit');
                    else if (iconClass.includes('delete')) btn.setAttribute('aria-label', 'Delete');
                    else if (iconClass.includes('search')) btn.setAttribute('aria-label', 'Search');
                    else if (iconClass.includes('close')) btn.setAttribute('aria-label', 'Close');
                }
            }
        });

        // Enhance tables
        document.querySelectorAll('table').forEach(table => {
            if (!table.getAttribute('role')) {
                table.setAttribute('role', 'grid');
            }
        });

        // Enhance modals
        document.querySelectorAll('.modal, .custom-modal').forEach(modal => {
            if (!modal.getAttribute('role')) {
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-modal', 'true');
            }
        });

        // Add labels to form controls without labels
        document.querySelectorAll('input:not([aria-label]), select:not([aria-label])').forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (!label && input.placeholder) {
                input.setAttribute('aria-label', input.placeholder);
            }
        });
    }

    // ==================== Announcements ====================

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     * @param {string} priority - 'polite' or 'assertive'
     */
    function announce(message, priority = 'polite') {
        if (!liveRegion) createLiveRegion();

        liveRegion.setAttribute('aria-live', priority);
        
        // Clear and set new message with delay for screen reader detection
        liveRegion.textContent = '';
        setTimeout(() => {
            liveRegion.textContent = message;
        }, CONFIG.announcerDelay);
    }

    /**
     * Announce loading state
     * @param {boolean} isLoading - Loading state
     * @param {string} context - What is loading
     */
    function announceLoading(isLoading, context = 'Content') {
        announce(isLoading ? `${context} đang tải...` : `${context} đã tải xong`, 'polite');
    }

    /**
     * Announce action result
     * @param {boolean} success - Success state
     * @param {string} action - Action description
     */
    function announceResult(success, action) {
        const message = success 
            ? `${action} thành công` 
            : `${action} thất bại`;
        announce(message, success ? 'polite' : 'assertive');
    }

    // ==================== Focus Management ====================

    /**
     * Get all focusable elements within container
     * @param {HTMLElement} container - Container element
     * @returns {HTMLElement[]} Focusable elements
     */
    function getFocusableElements(container = document) {
        return Array.from(container.querySelectorAll(CONFIG.focusableSelectors))
            .filter(el => {
                return el.offsetParent !== null && 
                       !el.hasAttribute('disabled') &&
                       el.getAttribute('tabindex') !== '-1';
            });
    }

    /**
     * Trap focus within a container (for modals)
     * @param {HTMLElement} container - Container to trap focus in
     */
    function trapFocus(container) {
        const focusableElements = getFocusableElements(container);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Store previous focus
        const previousFocus = document.activeElement;
        focusTrapStack.push({ container, previousFocus });

        // Focus first element
        firstElement.focus();

        // Handle tab key
        const handleTab = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        container.addEventListener('keydown', handleTab);
        container._focusTrapHandler = handleTab;
        container.classList.add(CONFIG.trapFocusClass);
    }

    /**
     * Release focus trap
     * @param {HTMLElement} container - Container to release
     */
    function releaseFocusTrap(container) {
        if (container._focusTrapHandler) {
            container.removeEventListener('keydown', container._focusTrapHandler);
            delete container._focusTrapHandler;
        }
        container.classList.remove(CONFIG.trapFocusClass);

        // Restore previous focus
        const trapInfo = focusTrapStack.pop();
        if (trapInfo && trapInfo.previousFocus) {
            trapInfo.previousFocus.focus();
        }
    }

    /**
     * Move focus to element safely
     * @param {HTMLElement|string} target - Element or selector
     * @param {Object} options - Focus options
     */
    function moveFocus(target, options = {}) {
        const element = typeof target === 'string' 
            ? document.querySelector(target) 
            : target;

        if (!element) return;

        // Make element focusable if needed
        if (!element.getAttribute('tabindex')) {
            element.setAttribute('tabindex', '-1');
        }

        element.focus(options);
    }

    /**
     * Focus first invalid field in form
     * @param {HTMLFormElement} form - Form element
     */
    function focusFirstInvalid(form) {
        const invalid = form.querySelector('.is-invalid, :invalid');
        if (invalid) {
            moveFocus(invalid);
            announce('Please correct the highlighted field');
        }
    }

    // ==================== ARIA Helpers ====================

    /**
     * Set ARIA busy state
     * @param {HTMLElement} element - Element
     * @param {boolean} busy - Busy state
     */
    function setAriaBusy(element, busy) {
        element.setAttribute('aria-busy', busy.toString());
    }

    /**
     * Set ARIA expanded state
     * @param {HTMLElement} trigger - Trigger element
     * @param {boolean} expanded - Expanded state
     */
    function setAriaExpanded(trigger, expanded) {
        trigger.setAttribute('aria-expanded', expanded.toString());
    }

    /**
     * Set ARIA selected state
     * @param {HTMLElement} element - Element
     * @param {boolean} selected - Selected state
     */
    function setAriaSelected(element, selected) {
        element.setAttribute('aria-selected', selected.toString());
    }

    /**
     * Set ARIA disabled state
     * @param {HTMLElement} element - Element
     * @param {boolean} disabled - Disabled state
     */
    function setAriaDisabled(element, disabled) {
        element.setAttribute('aria-disabled', disabled.toString());
        if (disabled) {
            element.setAttribute('tabindex', '-1');
        } else {
            element.removeAttribute('tabindex');
        }
    }

    /**
     * Link element to its description
     * @param {HTMLElement} element - Element
     * @param {string} descriptionId - ID of description element
     */
    function setAriaDescribedBy(element, descriptionId) {
        element.setAttribute('aria-describedby', descriptionId);
    }

    /**
     * Set ARIA label
     * @param {HTMLElement} element - Element
     * @param {string} label - Label text
     */
    function setAriaLabel(element, label) {
        element.setAttribute('aria-label', label);
    }

    // ==================== Table Navigation ====================

    /**
     * Setup keyboard navigation for table
     * @param {HTMLTableElement} table - Table element
     */
    function setupTableNavigation(table) {
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach((row, index) => {
            row.setAttribute('tabindex', index === 0 ? '0' : '-1');
            row.setAttribute('role', 'row');
            
            row.addEventListener('keydown', (e) => {
                let targetIndex = index;
                
                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        targetIndex = Math.min(index + 1, rows.length - 1);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        targetIndex = Math.max(index - 1, 0);
                        break;
                    case 'Home':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            targetIndex = 0;
                        }
                        break;
                    case 'End':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            targetIndex = rows.length - 1;
                        }
                        break;
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        const checkbox = row.querySelector('input[type="checkbox"]');
                        if (checkbox) checkbox.click();
                        break;
                    default:
                        return;
                }
                
                if (targetIndex !== index) {
                    rows[index].setAttribute('tabindex', '-1');
                    rows[targetIndex].setAttribute('tabindex', '0');
                    rows[targetIndex].focus();
                }
            });
        });
    }

    // ==================== Utility Functions ====================

    /**
     * Check if reduced motion is preferred
     * @returns {boolean}
     */
    function shouldReduceMotion() {
        return prefersReducedMotion;
    }

    /**
     * Get animation duration based on user preference
     * @param {number} normalDuration - Normal duration in ms
     * @returns {number} Adjusted duration
     */
    function getAnimationDuration(normalDuration = 300) {
        return prefersReducedMotion ? 0 : normalDuration;
    }

    // ==================== Public API ====================
    return {
        // Initialization
        init,
        
        // Announcements
        announce,
        announceLoading,
        announceResult,
        
        // Focus Management
        getFocusableElements,
        trapFocus,
        releaseFocusTrap,
        moveFocus,
        focusFirstInvalid,
        
        // ARIA Helpers
        setAriaBusy,
        setAriaExpanded,
        setAriaSelected,
        setAriaDisabled,
        setAriaDescribedBy,
        setAriaLabel,
        
        // Table Navigation
        setupTableNavigation,
        
        // Utilities
        shouldReduceMotion,
        getAnimationDuration,
        enhanceExistingElements
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Accessibility;
}
window.Accessibility = Accessibility;
