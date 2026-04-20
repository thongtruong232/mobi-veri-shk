/**
 * Clipboard Module
 * Provides clipboard operations with fallback support
 * @module Clipboard
 */

'use strict';

const ClipboardManager = (function() {
    /**
     * Copy text to clipboard with fallback support
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} True if successful
     */
    async function copyToClipboard(text) {
        if (!text && text !== '') return false;
        
        const textToCopy = String(text);
        
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                return true;
            } catch (error) {
                console.warn('Clipboard API failed, trying fallback:', error);
            }
        }
        
        // Fallback to execCommand
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = textToCopy;
            tempInput.style.position = 'fixed';
            tempInput.style.left = '-9999px';
            tempInput.style.top = '-9999px';
            document.body.appendChild(tempInput);
            tempInput.select();
            tempInput.setSelectionRange(0, 99999); // For mobile devices
            
            const success = document.execCommand('copy');
            document.body.removeChild(tempInput);
            return success;
        } catch (error) {
            console.error('Fallback copy failed:', error);
            return false;
        }
    }

    /**
     * Copy TextNow info with visual feedback
     * @param {Event} event - Click event
     * @param {string} fullInformation - Information to copy
     */
    async function copyTextNowInfo(event, fullInformation) {
        try {
            const textToCopy = fullInformation !== null && fullInformation !== undefined 
                ? String(fullInformation) 
                : '';
            
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
                event.stopPropagation();
            }

            const success = await copyToClipboard(textToCopy);
            
            // Show tooltip feedback
            const tooltip = document.createElement('div');
            tooltip.className = 'copy-tooltip';
            tooltip.textContent = success ? 'Copied!' : 'Copy failed!';

            const e = event || window.event;
            if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY - 25}px`;
            } else {
                tooltip.style.left = '50%';
                tooltip.style.top = '20px';
                tooltip.style.transform = 'translateX(-50%)';
            }

            document.body.appendChild(tooltip);
            tooltip.style.display = 'block';
            
            setTimeout(() => {
                if (tooltip.parentNode) {
                    document.body.removeChild(tooltip);
                }
            }, 1000);

            return success;
        } catch (error) {
            console.error('Error copying text:', error);
            return false;
        }
    }

    /**
     * Copy all selected records' full information
     * @returns {Promise<boolean>} True if successful
     */
    async function copyAllSelected() {
        const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
        const selectedFullInfos = Array.from(selectedRows)
            .map(checkbox => checkbox.getAttribute('data-full-info') || '')
            .filter(info => info);

        if (selectedFullInfos.length === 0) {
            if (typeof UIHelpers !== 'undefined') {
                UIHelpers.showNotification('Please select at least one record', 'error');
            } else {
                alert('Please select at least one record');
            }
            return false;
        }

        // Create text with line breaks
        const textToCopy = selectedFullInfos.join('\n');
        const success = await copyToClipboard(textToCopy);

        // Show tooltip feedback
        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = success
            ? `Copied ${selectedFullInfos.length} records!`
            : 'Copy failed!';

        const ev = window.event;
        if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
            tooltip.style.left = `${ev.clientX + 10}px`;
            tooltip.style.top = `${ev.clientY - 25}px`;
        } else {
            tooltip.style.left = '50%';
            tooltip.style.top = '20px';
            tooltip.style.transform = 'translateX(-50%)';
        }

        document.body.appendChild(tooltip);
        tooltip.style.display = 'block';
        
        setTimeout(() => {
            if (tooltip.parentNode) {
                document.body.removeChild(tooltip);
            }
        }, 1000);

        return success;
    }

    /**
     * Copy multiple items with custom separator
     * @param {string[]} items - Array of strings to copy
     * @param {string} separator - Separator between items
     * @returns {Promise<boolean>} True if successful
     */
    async function copyMultiple(items, separator = '\n') {
        if (!Array.isArray(items) || items.length === 0) {
            return false;
        }
        
        const textToCopy = items.filter(item => item).join(separator);
        return await copyToClipboard(textToCopy);
    }

    // Public API
    return {
        copyToClipboard,
        copyTextNowInfo,
        copyAllSelected,
        copyMultiple
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardManager;
}
window.ClipboardManager = ClipboardManager;

// Expose copyTextNowInfo globally for inline onclick handlers
window.copyTextNowInfo = ClipboardManager.copyTextNowInfo;
