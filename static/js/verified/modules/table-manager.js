/**
 * Table Manager Module
 * Phase 6: Enhanced with accessibility and loading states
 * Handles all table-related operations for the verified records table
 * @module TableManager
 */

'use strict';

const TableManager = (function() {
    // Cache DOM elements
    let tableBody = null;
    let selectAllCheckbox = null;
    let btnVerifiedSuccess = null;
    let btnVerifiedError = null;
    let btnCopyAll = null;

    // State
    let isTextNowStatus = true;
    let currentSkeletonId = null;
    
    // Virtual/Progressive Rendering Configuration
    const RENDER_CONFIG = {
        CHUNK_SIZE: 50,           // Rows per chunk
        CHUNK_DELAY: 16,          // ~60fps frame time
        LARGE_DATASET_THRESHOLD: 200  // Use progressive render above this count
    };
    
    // Store all records for re-rendering
    let allRecords = [];
    let renderAbortController = null;

    /**
     * Initialize the table manager
     */
    function init() {
        cacheElements();
        setupEventListeners();
        enhanceAccessibility();
    }

    /**
     * Cache DOM elements for performance
     */
    function cacheElements() {
        tableBody = document.getElementById('verifiedTableBody');
        selectAllCheckbox = document.getElementById('selectAll');
        btnVerifiedSuccess = document.getElementById('btnVerifiedSuccess');
        btnVerifiedError = document.getElementById('btnVerifiedError');
        btnCopyAll = document.getElementById('btnCopyAll');
    }

    /**
     * Enhance table accessibility
     */
    function enhanceAccessibility() {
        const table = tableBody?.closest('table');
        if (table) {
            table.setAttribute('role', 'grid');
            table.setAttribute('aria-label', 'Verified records table');
            
            // Add aria-sort to sortable headers if any
            table.querySelectorAll('th').forEach((th, index) => {
                th.setAttribute('scope', 'col');
                th.setAttribute('role', 'columnheader');
            });
        }
        
        // Add label to select all checkbox
        if (selectAllCheckbox) {
            selectAllCheckbox.setAttribute('aria-label', 'Select all records');
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Event delegation for row click
        if (tableBody) {
            tableBody.addEventListener('click', handleRowClick);
            // Keyboard navigation for table
            tableBody.addEventListener('keydown', handleTableKeydown);
        }

        // Select all checkbox
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', toggleSelectAll);
        }

        // Copy all button
        if (btnCopyAll) {
            btnCopyAll.addEventListener('click', () => {
                ClipboardManager.copyAllSelected();
            });
        }

        // Verified buttons
        if (btnVerifiedSuccess) {
            btnVerifiedSuccess.addEventListener('click', () => {
                updateMultipleStatus('verified');
            });
        }

        if (btnVerifiedError) {
            btnVerifiedError.addEventListener('click', () => {
                updateMultipleStatus('error');
            });
        }
    }

    /**
     * Handle keyboard navigation in table
     * @param {KeyboardEvent} e - Keyboard event
     */
    function handleTableKeydown(e) {
        const row = e.target.closest('tr');
        if (!row) return;
        
        const rows = Array.from(tableBody.querySelectorAll('tr'));
        const currentIndex = rows.indexOf(row);
        let targetIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                targetIndex = Math.min(currentIndex + 1, rows.length - 1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                targetIndex = Math.max(currentIndex - 1, 0);
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
            case ' ':
            case 'Enter':
                e.preventDefault();
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.click();
                return;
            default:
                return;
        }
        
        if (targetIndex !== currentIndex && rows[targetIndex]) {
            rows[currentIndex].setAttribute('tabindex', '-1');
            rows[targetIndex].setAttribute('tabindex', '0');
            rows[targetIndex].focus();
        }
    }

    /**
     * Handle row click for selection
     * @param {Event} e - Click event
     */
    function handleRowClick(e) {
        // Ignore clicks on inputs or buttons
        if (e.target.closest('input') || e.target.closest('button') || e.target.closest('a')) {
            return;
        }

        const row = e.target.closest('tr');
        if (!row) return;

        const checkbox = row.querySelector('input[name="recordCheckbox"]');
        if (checkbox && !checkbox.disabled) {
            checkbox.checked = !checkbox.checked;
            handleCheckboxChange(checkbox);
        }
    }

    /**
     * Handle checkbox change
     * @param {HTMLElement} checkbox - Checkbox element
     */
    function handleCheckboxChange(checkbox) {
        const row = checkbox.closest('tr');
        if (checkbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
        toggleActionButtons();
    }

    /**
     * Toggle select all checkboxes
     */
    function toggleSelectAll() {
        const checkboxes = document.querySelectorAll('input[name="recordCheckbox"]:not(:disabled)');
        const isChecked = selectAllCheckbox ? selectAllCheckbox.checked : false;

        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const row = checkbox.closest('tr');
            if (isChecked) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });

        toggleActionButtons();
    }

    /**
     * Toggle visibility of action buttons based on selection
     */
    function toggleActionButtons() {
        const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
        const hasSelection = selectedRows.length > 0;

        if (btnVerifiedSuccess) {
            btnVerifiedSuccess.style.display = hasSelection ? 'inline-block' : 'none';
        }
        if (btnVerifiedError) {
            btnVerifiedError.style.display = hasSelection ? 'inline-block' : 'none';
        }
        if (btnCopyAll) {
            btnCopyAll.style.display = hasSelection ? 'inline-block' : 'none';
        }
    }

    /**
     * Show skeleton loading in table
     * @param {number} rowCount - Number of skeleton rows
     */
    function showSkeleton(rowCount = 10) {
        if (!tableBody) {
            tableBody = document.getElementById('verifiedTableBody');
        }
        if (!tableBody) return;

        // Use LoadingStates module if available
        if (typeof LoadingStates !== 'undefined') {
            currentSkeletonId = LoadingStates.showTableSkeleton(tableBody, rowCount, 9);
        } else {
            // Fallback skeleton
            let skeletonHtml = '';
            for (let i = 0; i < rowCount; i++) {
                skeletonHtml += `
                    <tr class="skeleton-row">
                        ${Array(9).fill('<td><div class="skeleton skeleton-text skeleton-shimmer"></div></td>').join('')}
                    </tr>
                `;
            }
            tableBody.innerHTML = skeletonHtml;
        }
        
        // Announce loading for screen readers
        if (typeof Accessibility !== 'undefined') {
            Accessibility.announceLoading(true, 'Table data');
        }
    }

    /**
     * Hide skeleton loading
     */
    function hideSkeleton() {
        if (currentSkeletonId && typeof LoadingStates !== 'undefined') {
            LoadingStates.hideTableSkeleton(currentSkeletonId);
            currentSkeletonId = null;
        }
        
        if (typeof Accessibility !== 'undefined') {
            Accessibility.announceLoading(false, 'Table data');
        }
    }

    /**
     * Display verified records in the table with progressive rendering for large datasets
     * @param {Array} records - Array of record objects
     */
    function displayRecords(records) {
        if (!tableBody) {
            tableBody = document.getElementById('verifiedTableBody');
        }

        if (!tableBody) {
            console.error('Table body element not found');
            return;
        }

        // Abort any ongoing progressive render
        if (renderAbortController) {
            renderAbortController.abort = true;
        }

        // Hide any active skeleton
        hideSkeleton();
        
        tableBody.innerHTML = '';

        const safeRecords = Array.isArray(records)
            ? records.filter(record => record && typeof record === 'object' && 'email' in record)
            : [];

        // Store for potential re-use
        allRecords = safeRecords;

        if (safeRecords.length === 0) {
            // Use empty state component if available
            if (typeof LoadingStates !== 'undefined') {
                LoadingStates.showEmptyState(tableBody, {
                    icon: 'fa-inbox',
                    title: 'No records found',
                    description: 'Try adjusting your search filters or date range.'
                });
                
                // Wrap in table structure
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `<td colspan="9"></td>`;
                emptyRow.querySelector('td').appendChild(tableBody.firstChild);
                tableBody.innerHTML = '';
                tableBody.appendChild(emptyRow);
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-4">
                            <div class="empty-state">
                                <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                                <h5>No records found</h5>
                                <p class="text-muted">Try adjusting your search filters or date range.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
            resetSelectAll();
            toggleActionButtons();
            
            // Announce for screen readers
            if (typeof Accessibility !== 'undefined') {
                Accessibility.announce('No records found');
            }
            return;
        }

        // Use progressive rendering for large datasets
        if (safeRecords.length > RENDER_CONFIG.LARGE_DATASET_THRESHOLD) {
            progressiveRender(safeRecords);
        } else {
            // Fast path for smaller datasets
            renderAllAtOnce(safeRecords);
        }

        resetSelectAll();
        toggleActionButtons();
        
        // Announce record count for screen readers
        if (typeof Accessibility !== 'undefined') {
            Accessibility.announce(`Loaded ${safeRecords.length} records`);
        }
    }

    /**
     * Render all records at once (for small datasets)
     * @param {Array} records - Records to render
     */
    function renderAllAtOnce(records) {
        const fragment = document.createDocumentFragment();

        records.forEach((record, idx) => {
            try {
                const row = createTableRow(record, records.length - idx);
                // Add tabindex for keyboard navigation
                if (idx === 0) {
                    row.setAttribute('tabindex', '0');
                } else {
                    row.setAttribute('tabindex', '-1');
                }
                fragment.appendChild(row);
            } catch (error) {
                console.error('Error creating row for record:', error, record);
                const errorRow = document.createElement('tr');
                errorRow.className = 'table-danger';
                errorRow.innerHTML = `
                    <td colspan="9" class="text-center text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error displaying record: ${typeof Security !== 'undefined' ? Security.escapeHtml(error.message) : error.message}
                    </td>
                `;
                fragment.appendChild(errorRow);
            }
        });

        tableBody.appendChild(fragment);
    }

    /**
     * Progressive rendering for large datasets
     * Renders in chunks using requestAnimationFrame to keep UI responsive
     * @param {Array} records - Records to render
     */
    function progressiveRender(records) {
        const totalRecords = records.length;
        let currentIndex = 0;
        
        // Create abort controller for this render cycle
        renderAbortController = { abort: false };
        const controller = renderAbortController;

        // Show loading indicator for first chunk
        const loadingRow = document.createElement('tr');
        loadingRow.id = 'progressive-loading';
        loadingRow.innerHTML = `
            <td colspan="9" class="text-center py-3">
                <span class="spinner-border spinner-border-sm me-2"></span>
                Loading records... <span id="render-progress">0</span>/${totalRecords}
            </td>
        `;
        tableBody.appendChild(loadingRow);

        function renderChunk() {
            // Check if aborted
            if (controller.abort) {
                console.log('[ProgressiveRender] Aborted');
                return;
            }

            const chunkEnd = Math.min(currentIndex + RENDER_CONFIG.CHUNK_SIZE, totalRecords);
            const fragment = document.createDocumentFragment();

            for (let i = currentIndex; i < chunkEnd; i++) {
                const record = records[i];
                try {
                    const row = createTableRow(record, totalRecords - i);
                    fragment.appendChild(row);
                } catch (error) {
                    console.error('Error creating row:', error, record);
                }
            }

            // Insert before loading row
            const loadingEl = document.getElementById('progressive-loading');
            if (loadingEl) {
                tableBody.insertBefore(fragment, loadingEl);
                
                // Update progress
                const progressEl = document.getElementById('render-progress');
                if (progressEl) {
                    progressEl.textContent = chunkEnd;
                }
            } else {
                tableBody.appendChild(fragment);
            }

            currentIndex = chunkEnd;

            if (currentIndex < totalRecords) {
                // Schedule next chunk using requestAnimationFrame for smooth UI
                requestAnimationFrame(() => {
                    setTimeout(renderChunk, RENDER_CONFIG.CHUNK_DELAY);
                });
            } else {
                // Done - remove loading indicator
                const loadingToRemove = document.getElementById('progressive-loading');
                if (loadingToRemove) {
                    loadingToRemove.remove();
                }
                console.log(`[ProgressiveRender] Complete: ${totalRecords} rows`);
            }
        }

        // Start rendering
        requestAnimationFrame(renderChunk);
    }

    /**
     * Create a table row for a record
     * @param {Object} record - Record data
     * @param {number} rowNum - Row number
     * @returns {HTMLElement} Table row element
     */
    function createTableRow(record, rowNum) {
        const isVerified = record.status_account_TN === 'verified';
        const isRegOk = ['success', 'resend link', 'not reg', 'error'].includes(record.status_account_TN);

        const safeEmail = Utils.sanitizeData(record.email || '');
        const safePassTN = Utils.sanitizeData(record.pass_TN || '');
        const safeFullInfo = Utils.sanitizeData(record.full_information || '');
        const safeCreatedBy = Utils.sanitizeData(record.created_by || '');
        const safeStatusTN = Utils.sanitizeData(record.status_account_TN || '');
        const safeStatusTF = Utils.sanitizeData(record.status_account_TF || '');

        const row = document.createElement('tr');
        row.className = `selectable-row ${isRegOk ? 'reg-ok-row' : ''}`;
        row.dataset.email = safeEmail;

        row.innerHTML = `
            <td>
                <input type="checkbox" name="recordCheckbox" value="${safeEmail}" 
                    class="form-check-input" 
                    data-full-info="${safeFullInfo}"
                    ${isVerified ? 'disabled' : ''}>
            </td>
            <td>${rowNum}</td>
            <td>${safeEmail}</td>
            <td>${safePassTN}</td>
            <td>
                <span class="status-badge ${Utils.getStatusClass(safeStatusTN)}">
                    ${safeStatusTN}
                </span>
            </td>
            <td>
                <span class="status-badge ${Utils.getStatusClass(safeStatusTF)}">
                    ${safeStatusTF}
                </span>
            </td>
            <td>${Utils.formatDateToDDMMYYYY(record.created_at)}</td>
            <td>${safeCreatedBy}</td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-primary copy-btn" 
                            onclick="copyTextNowInfo(event, '${safeEmail}')"
                            title="Copy email">
                        <i class="fas fa-envelope"></i>
                    </button>
                    <button class="btn btn-sm btn-primary copy-btn" 
                            onclick="copyTextNowInfo(event, '${safePassTN}')"
                            title="Copy TextNow password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn btn-sm btn-primary copy-btn" 
                            onclick="copyTextNowInfo(event, '${safeFullInfo}')"
                            title="Copy full information">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-sm btn-primary copy-btn" 
                            onclick="queueGetLink(event, '${safeFullInfo}')"
                            title="Get linked info">
                        <i class="fas fa-link"></i>
                    </button>
                    <button class="btn btn-sm btn-warning edit-btn" 
                            onclick="editRecord('${safeEmail}', '${safeStatusTN}', '${safeStatusTF}')"
                            title="Edit status">
                        <i class="fas fa-edit"></i>
                    </button>
                    <a id="link-${safeEmail.replace(/[^a-zA-Z0-9]/g, '-')}" 
                       href="#" 
                       target="_blank" 
                       draggable="true"
                       class="btn btn-sm btn-success" 
                       style="display: none; min-width: 20px; padding: 0rem 0.75rem; text-align: center;"
                       title="Open verification link">
                        Link
                    </a>
                </div>
            </td>
        `;

        // Add checkbox change event listener
        const checkbox = row.querySelector('input[name="recordCheckbox"]');
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                handleCheckboxChange(this);
            });
        }

        return row;
    }

    /**
     * Reset select all checkbox
     */
    function resetSelectAll() {
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
        }
    }

    /**
     * Update row status in table without reload (uses RAF for smooth updates)
     * @param {string} email - Email to update
     * @param {string} newStatus - New status value
     * @param {string} statusType - Status type ('TN' or 'TF')
     */
    function updateRowStatus(email, newStatus, statusType = 'TN') {
        if (!tableBody) {
            tableBody = document.getElementById('verifiedTableBody');
        }

        const row = tableBody.querySelector(`tr[data-email="${email}"]`);
        if (!row) return null;

        // Use RAF for smooth DOM updates
        requestAnimationFrame(() => {
            // Update status badge
            const statusCell = statusType === 'TN'
                ? row.querySelector('td:nth-child(5) .status-badge')
                : row.querySelector('td:nth-child(6) .status-badge');

            if (statusCell) {
                statusCell.textContent = newStatus;
                statusCell.className = 'status-badge ' + Utils.getStatusClass(newStatus);
            }

            // Disable checkbox if verified
            if (newStatus === 'verified') {
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                }
                row.classList.remove('reg-ok-row');
            }
        });

        return row;
    }

    /**
     * Batch update multiple row statuses (optimized)
     * @param {Array<{email: string, status: string, statusType: string}>} updates - Array of update objects
     */
    function batchUpdateRowStatuses(updates) {
        if (!tableBody) {
            tableBody = document.getElementById('verifiedTableBody');
        }

        // Use RAF for batched DOM updates
        requestAnimationFrame(() => {
            updates.forEach(({ email, status, statusType = 'TN' }) => {
                const row = tableBody.querySelector(`tr[data-email="${email}"]`);
                if (!row) return;

                const statusCell = statusType === 'TN'
                    ? row.querySelector('td:nth-child(5) .status-badge')
                    : row.querySelector('td:nth-child(6) .status-badge');

                if (statusCell) {
                    statusCell.textContent = status;
                    statusCell.className = 'status-badge ' + Utils.getStatusClass(status);
                }

                if (status === 'verified') {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = false;
                        checkbox.disabled = true;
                    }
                    row.classList.remove('reg-ok-row');
                }
            });
        });
    }

    /**
     * Update multiple records status (optimized with batch updates)
     * @param {string} status - New status ('verified' or 'error')
     */
    async function updateMultipleStatus(status) {
        const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
        const emails = Array.from(selectedRows).map(checkbox => checkbox.value);

        if (emails.length === 0) {
            UIHelpers.showNotification('Please select at least one record', 'error');
            return;
        }

        const statusType = isTextNowStatus ? 'TN' : 'TF';
        const statusField = isTextNowStatus ? 'status_account_TN' : 'status_account_TF';

        const confirmMessage = status === 'verified'
            ? `Are you sure you want to mark ${emails.length} records as "Verified" for ${statusType}?`
            : `Are you sure you want to mark ${emails.length} records as "Error" for ${statusType}?`;

        if (!confirm(confirmMessage)) {
            return;
        }

        // Set buttons to loading state
        const successBtnState = btnVerifiedSuccess ? UIHelpers.setButtonLoading(btnVerifiedSuccess, 'Processing...') : null;
        const errorBtnState = btnVerifiedError ? UIHelpers.setButtonLoading(btnVerifiedError, 'Processing...') : null;

        try {
            const promises = emails.map(email => {
                return ApiService.updateTextNowStatus(email, statusField, status)
                    .then(data => ({ email, data }))
                    .catch(error => ({ email, error }));
            });

            const results = await Promise.all(promises);

            let successCount = 0;
            let errorCount = 0;
            const successfulUpdates = [];

            results.forEach(result => {
                if (result.data && result.data.success) {
                    successCount++;
                    successfulUpdates.push({
                        email: result.email,
                        status: status,
                        statusType: statusType
                    });
                } else {
                    errorCount++;
                }
            });

            // Batch update all successful rows in a single RAF cycle
            if (successfulUpdates.length > 0) {
                batchUpdateRowStatuses(successfulUpdates);
            }

            if (successCount > 0) {
                UIHelpers.showNotification(`Updated successfully ${successCount} records for ${statusType}`);
            }
            if (errorCount > 0) {
                UIHelpers.showNotification(`Failed to update ${errorCount} records for ${statusType}`, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            UIHelpers.showNotification(`An error occurred when updating ${statusType} status: ${error.message}`, 'error');
        } finally {
            if (successBtnState) successBtnState.restore();
            if (errorBtnState) errorBtnState.restore();
        }
    }

    /**
     * Set status type (TextNow or TextFree)
     * @param {boolean} isTextNow - True for TextNow, false for TextFree
     */
    function setStatusType(isTextNow) {
        isTextNowStatus = isTextNow;
    }

    /**
     * Get current status type
     * @returns {boolean} True if TextNow status
     */
    function getStatusType() {
        return isTextNowStatus;
    }

    /**
     * Update created by dropdown
     * @param {Array} creators - List of creator names
     * @param {string} selectedValue - Currently selected value
     */
    function updateCreatedByDropdown(creators, selectedValue = '') {
        const createdBySelect = document.getElementById('createdBy');
        if (!createdBySelect) return;

        createdBySelect.innerHTML = '<option value="">All</option>';

        if (creators && creators.length > 0) {
            creators.forEach(creator => {
                const option = document.createElement('option');
                option.value = creator;
                option.textContent = creator;
                createdBySelect.appendChild(option);
            });

            if (selectedValue) {
                createdBySelect.value = selectedValue;
            }
        }
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
        displayRecords,
        updateRowStatus,
        batchUpdateRowStatuses,
        updateMultipleStatus,
        toggleSelectAll,
        toggleActionButtons,
        handleCheckboxChange,
        setStatusType,
        getStatusType,
        updateCreatedByDropdown,
        // Phase 6: Loading states
        showSkeleton,
        hideSkeleton
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableManager;
}
window.TableManager = TableManager;

// Global function for inline onclick
window.handleCheckboxChange = function(checkbox) {
    TableManager.handleCheckboxChange(checkbox);
};
