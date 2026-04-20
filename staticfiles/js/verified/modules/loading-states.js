/**
 * Loading States Module
 * Phase 6: UI/UX Enhancements
 * 
 * Provides advanced loading states including:
 * - Skeleton loaders
 * - Progress indicators
 * - Button loading states
 * - Content placeholders
 * - Shimmer effects
 * 
 * @module LoadingStates
 * @version 1.0.0
 */

'use strict';

const LoadingStates = (function() {
    // ==================== Configuration ====================
    const CONFIG = {
        skeletonClass: 'skeleton',
        shimmerClass: 'skeleton-shimmer',
        loadingClass: 'is-loading',
        minLoadingTime: 300 // Minimum loading time to prevent flash
    };

    // Track active loading states
    const activeLoaders = new Map();

    // ==================== Skeleton Loaders ====================

    /**
     * Create skeleton element
     * @param {string} type - Type of skeleton ('text', 'circle', 'rect', 'table-row')
     * @param {Object} options - Skeleton options
     * @returns {HTMLElement} Skeleton element
     */
    function createSkeleton(type = 'text', options = {}) {
        const {
            width = '100%',
            height = null,
            lines = 1,
            className = ''
        } = options;

        const skeleton = document.createElement('div');
        skeleton.className = `${CONFIG.skeletonClass} ${CONFIG.shimmerClass} ${className}`.trim();

        switch (type) {
            case 'text':
                skeleton.classList.add('skeleton-text');
                skeleton.style.width = width;
                skeleton.style.height = height || '1em';
                break;
                
            case 'circle':
                skeleton.classList.add('skeleton-circle');
                skeleton.style.width = width;
                skeleton.style.height = width;
                break;
                
            case 'rect':
                skeleton.classList.add('skeleton-rect');
                skeleton.style.width = width;
                skeleton.style.height = height || '100px';
                break;
                
            case 'paragraph':
                skeleton.classList.add('skeleton-paragraph');
                for (let i = 0; i < lines; i++) {
                    const line = document.createElement('div');
                    line.className = `${CONFIG.skeletonClass} skeleton-text ${CONFIG.shimmerClass}`;
                    line.style.width = i === lines - 1 ? '60%' : '100%';
                    skeleton.appendChild(line);
                }
                break;
                
            case 'table-row':
                skeleton.classList.add('skeleton-table-row');
                skeleton.innerHTML = createTableRowSkeleton(options.columns || 5);
                break;
                
            case 'card':
                skeleton.classList.add('skeleton-card');
                skeleton.innerHTML = `
                    <div class="skeleton skeleton-rect skeleton-shimmer" style="height: 150px;"></div>
                    <div class="p-3">
                        <div class="skeleton skeleton-text skeleton-shimmer mb-2" style="width: 80%;"></div>
                        <div class="skeleton skeleton-text skeleton-shimmer" style="width: 60%;"></div>
                    </div>
                `;
                break;
        }

        return skeleton;
    }

    /**
     * Create skeleton for table row
     * @param {number} columns - Number of columns
     * @returns {string} HTML string
     */
    function createTableRowSkeleton(columns) {
        let html = '<tr class="skeleton-row">';
        for (let i = 0; i < columns; i++) {
            html += `
                <td>
                    <div class="skeleton skeleton-text skeleton-shimmer" 
                         style="width: ${70 + Math.random() * 30}%;"></div>
                </td>
            `;
        }
        html += '</tr>';
        return html;
    }

    /**
     * Show skeleton loading for table
     * @param {HTMLElement} tableBody - Table body element
     * @param {number} rowCount - Number of skeleton rows
     * @param {number} columnCount - Number of columns
     */
    function showTableSkeleton(tableBody, rowCount = 10, columnCount = 9) {
        if (!tableBody) return;

        const loaderId = `table-${Date.now()}`;
        const originalContent = tableBody.innerHTML;
        
        activeLoaders.set(loaderId, { element: tableBody, originalContent });

        let skeletonHtml = '';
        for (let i = 0; i < rowCount; i++) {
            skeletonHtml += createTableRowSkeleton(columnCount);
        }
        tableBody.innerHTML = skeletonHtml;
        tableBody.classList.add(CONFIG.loadingClass);

        // Announce loading for screen readers
        if (typeof Accessibility !== 'undefined') {
            Accessibility.announceLoading(true, 'Table data');
        }

        return loaderId;
    }

    /**
     * Hide skeleton loading for table
     * @param {string} loaderId - Loader ID from showTableSkeleton
     * @param {string} newContent - New content to display
     */
    function hideTableSkeleton(loaderId, newContent = null) {
        const loader = activeLoaders.get(loaderId);
        if (!loader) return;

        const { element, originalContent } = loader;
        
        setTimeout(() => {
            element.innerHTML = newContent !== null ? newContent : originalContent;
            element.classList.remove(CONFIG.loadingClass);
            activeLoaders.delete(loaderId);

            if (typeof Accessibility !== 'undefined') {
                Accessibility.announceLoading(false, 'Table data');
            }
        }, CONFIG.minLoadingTime);
    }

    /**
     * Show content skeleton
     * @param {HTMLElement} container - Container element
     * @param {string} type - Skeleton type
     * @param {Object} options - Options
     * @returns {string} Loader ID
     */
    function showContentSkeleton(container, type = 'paragraph', options = {}) {
        if (!container) return null;

        const loaderId = `content-${Date.now()}`;
        const originalContent = container.innerHTML;
        const originalDisplay = container.style.display;
        
        activeLoaders.set(loaderId, { element: container, originalContent, originalDisplay });

        const skeleton = createSkeleton(type, options);
        container.innerHTML = '';
        container.appendChild(skeleton);
        container.classList.add(CONFIG.loadingClass);

        return loaderId;
    }

    /**
     * Hide content skeleton
     * @param {string} loaderId - Loader ID
     * @param {string|HTMLElement} newContent - New content
     */
    function hideContentSkeleton(loaderId, newContent = null) {
        const loader = activeLoaders.get(loaderId);
        if (!loader) return;

        const { element, originalContent } = loader;

        setTimeout(() => {
            if (newContent !== null) {
                if (typeof newContent === 'string') {
                    element.innerHTML = newContent;
                } else if (newContent instanceof HTMLElement) {
                    element.innerHTML = '';
                    element.appendChild(newContent);
                }
            } else {
                element.innerHTML = originalContent;
            }
            element.classList.remove(CONFIG.loadingClass);
            activeLoaders.delete(loaderId);
        }, CONFIG.minLoadingTime);
    }

    // ==================== Progress Indicators ====================

    /**
     * Create progress bar
     * @param {Object} options - Progress options
     * @returns {Object} Progress bar controller
     */
    function createProgressBar(options = {}) {
        const {
            container = document.body,
            position = 'top', // 'top', 'bottom', 'inline'
            color = 'var(--primary-color, #3498db)',
            height = '3px',
            indeterminate = false
        } = options;

        const progressWrapper = document.createElement('div');
        progressWrapper.className = `progress-bar-wrapper progress-${position}`;
        progressWrapper.style.cssText = `
            position: ${position === 'inline' ? 'relative' : 'fixed'};
            ${position === 'top' ? 'top: 0;' : ''}
            ${position === 'bottom' ? 'bottom: 0;' : ''}
            left: 0;
            width: 100%;
            height: ${height};
            background: rgba(0, 0, 0, 0.1);
            z-index: 9999;
            overflow: hidden;
        `;

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar-fill';
        progressBar.style.cssText = `
            width: ${indeterminate ? '30%' : '0%'};
            height: 100%;
            background: ${color};
            transition: width 0.3s ease;
            ${indeterminate ? 'animation: progress-indeterminate 1.5s ease-in-out infinite;' : ''}
        `;

        progressWrapper.appendChild(progressBar);
        container.appendChild(progressWrapper);

        // Add ARIA attributes
        progressWrapper.setAttribute('role', 'progressbar');
        progressWrapper.setAttribute('aria-valuemin', '0');
        progressWrapper.setAttribute('aria-valuemax', '100');
        progressWrapper.setAttribute('aria-valuenow', '0');

        return {
            element: progressWrapper,
            
            setProgress(percent) {
                const value = Math.min(100, Math.max(0, percent));
                progressBar.style.width = `${value}%`;
                progressWrapper.setAttribute('aria-valuenow', value.toString());
                
                if (value >= 100) {
                    setTimeout(() => this.hide(), 300);
                }
            },
            
            increment(amount = 10) {
                const current = parseFloat(progressBar.style.width) || 0;
                this.setProgress(current + amount);
            },
            
            show() {
                progressWrapper.style.display = 'block';
                progressWrapper.style.opacity = '1';
            },
            
            hide() {
                progressWrapper.style.opacity = '0';
                setTimeout(() => {
                    progressWrapper.style.display = 'none';
                    progressBar.style.width = '0%';
                }, 300);
            },
            
            destroy() {
                if (progressWrapper.parentNode) {
                    progressWrapper.parentNode.removeChild(progressWrapper);
                }
            }
        };
    }

    /**
     * Create circular spinner
     * @param {Object} options - Spinner options
     * @returns {HTMLElement} Spinner element
     */
    function createSpinner(options = {}) {
        const {
            size = 'md', // 'sm', 'md', 'lg'
            color = 'primary',
            text = ''
        } = options;

        const sizeMap = { sm: '1rem', md: '2rem', lg: '3rem' };
        const spinnerSize = sizeMap[size] || size;

        const wrapper = document.createElement('div');
        wrapper.className = 'spinner-wrapper d-flex flex-column align-items-center';
        wrapper.innerHTML = `
            <div class="spinner-border text-${color}" role="status" 
                 style="width: ${spinnerSize}; height: ${spinnerSize};">
                <span class="visually-hidden">Loading...</span>
            </div>
            ${text ? `<span class="spinner-text mt-2 text-muted">${Security ? Security.escapeHtml(text) : text}</span>` : ''}
        `;

        return wrapper;
    }

    // ==================== Button Loading States ====================

    /**
     * Set button to loading state
     * @param {HTMLButtonElement} button - Button element
     * @param {Object} options - Loading options
     * @returns {Object} State controller
     */
    function setButtonLoading(button, options = {}) {
        if (!button) return null;

        const {
            text = 'Loading...',
            spinnerSize = 'sm',
            disabled = true
        } = typeof options === 'string' ? { text: options } : options;

        const originalContent = button.innerHTML;
        const originalDisabled = button.disabled;
        const originalWidth = button.offsetWidth;

        // Preserve button width to prevent layout shift
        button.style.minWidth = `${originalWidth}px`;
        button.disabled = disabled;
        button.classList.add('btn-loading');
        
        button.innerHTML = `
            <span class="spinner-border spinner-border-${spinnerSize} me-2" role="status" aria-hidden="true"></span>
            ${Security ? Security.escapeHtml(text) : text}
        `;

        return {
            restore() {
                button.innerHTML = originalContent;
                button.disabled = originalDisabled;
                button.style.minWidth = '';
                button.classList.remove('btn-loading');
            },
            
            updateText(newText) {
                const textNode = button.childNodes[button.childNodes.length - 1];
                if (textNode) {
                    textNode.textContent = newText;
                }
            }
        };
    }

    // ==================== Empty States ====================

    /**
     * Create empty state component
     * @param {Object} options - Empty state options
     * @returns {HTMLElement} Empty state element
     */
    function createEmptyState(options = {}) {
        const {
            icon = 'fa-inbox',
            title = 'No data',
            description = 'There is no data to display.',
            action = null, // { text: 'Add new', onClick: fn }
            className = ''
        } = options;

        const emptyState = document.createElement('div');
        emptyState.className = `empty-state text-center py-5 ${className}`;
        emptyState.innerHTML = `
            <div class="empty-state-icon mb-3">
                <i class="fas ${icon} fa-3x text-muted"></i>
            </div>
            <h5 class="empty-state-title text-dark mb-2">${Security ? Security.escapeHtml(title) : title}</h5>
            <p class="empty-state-description text-muted mb-3">${Security ? Security.escapeHtml(description) : description}</p>
            ${action ? `
                <button class="btn btn-primary empty-state-action">
                    ${action.icon ? `<i class="fas ${action.icon} me-2"></i>` : ''}
                    ${Security ? Security.escapeHtml(action.text) : action.text}
                </button>
            ` : ''}
        `;

        if (action && action.onClick) {
            const actionBtn = emptyState.querySelector('.empty-state-action');
            if (actionBtn) {
                actionBtn.addEventListener('click', action.onClick);
            }
        }

        return emptyState;
    }

    /**
     * Show empty state in container
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Empty state options
     */
    function showEmptyState(container, options = {}) {
        if (!container) return;

        const emptyState = createEmptyState(options);
        container.innerHTML = '';
        container.appendChild(emptyState);
    }

    // ==================== Inline Loading ====================

    /**
     * Create inline loading indicator
     * @param {string} text - Loading text
     * @returns {HTMLElement} Loading element
     */
    function createInlineLoader(text = 'Loading...') {
        const loader = document.createElement('span');
        loader.className = 'inline-loader';
        loader.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            <span class="inline-loader-text">${Security ? Security.escapeHtml(text) : text}</span>
        `;
        return loader;
    }

    /**
     * Replace element with loader temporarily
     * @param {HTMLElement} element - Element to replace
     * @param {string} loadingText - Loading text
     * @returns {Function} Restore function
     */
    function replaceWithLoader(element, loadingText = 'Loading...') {
        if (!element) return () => {};

        const originalContent = element.innerHTML;
        const loader = createInlineLoader(loadingText);
        element.innerHTML = '';
        element.appendChild(loader);

        return function restore(newContent = null) {
            element.innerHTML = newContent !== null ? newContent : originalContent;
        };
    }

    // ==================== CSS Injection ====================

    /**
     * Inject required CSS for loading states
     */
    function injectCSS() {
        if (document.getElementById('loading-states-css')) return;

        const css = document.createElement('style');
        css.id = 'loading-states-css';
        css.textContent = `
            /* Skeleton Styles */
            .skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                border-radius: 4px;
            }
            
            .skeleton-shimmer {
                animation: skeleton-shimmer 1.5s infinite;
            }
            
            @keyframes skeleton-shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            
            .skeleton-text {
                height: 1em;
                margin-bottom: 0.5em;
            }
            
            .skeleton-circle {
                border-radius: 50%;
            }
            
            .skeleton-paragraph .skeleton-text:last-child {
                margin-bottom: 0;
            }
            
            .skeleton-row td {
                padding: 1rem 0.5rem;
            }
            
            .skeleton-card {
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            /* Progress Bar */
            @keyframes progress-indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(400%); }
            }
            
            .progress-bar-wrapper {
                transition: opacity 0.3s ease;
            }
            
            /* Button Loading */
            .btn-loading {
                pointer-events: none;
                opacity: 0.8;
            }
            
            /* Empty State */
            .empty-state {
                padding: 3rem 1rem;
            }
            
            .empty-state-icon {
                opacity: 0.5;
            }
            
            /* Inline Loader */
            .inline-loader {
                display: inline-flex;
                align-items: center;
            }
            
            /* Loading overlay for containers */
            .is-loading {
                position: relative;
                pointer-events: none;
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .skeleton-shimmer {
                    animation: none;
                }
                
                .progress-bar-fill {
                    transition: none;
                }
            }
        `;
        document.head.appendChild(css);
    }

    // Initialize CSS on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectCSS);
    } else {
        injectCSS();
    }

    // ==================== Public API ====================
    return {
        // Skeleton Loaders
        createSkeleton,
        showTableSkeleton,
        hideTableSkeleton,
        showContentSkeleton,
        hideContentSkeleton,
        
        // Progress Indicators
        createProgressBar,
        createSpinner,
        
        // Button States
        setButtonLoading,
        
        // Empty States
        createEmptyState,
        showEmptyState,
        
        // Inline Loading
        createInlineLoader,
        replaceWithLoader,
        
        // Configuration
        CONFIG
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingStates;
}
window.LoadingStates = LoadingStates;
