// Lấy useroffice
let userOffice = '';
async function getUserOffice() {
    // Lấy office của user hiện tại
    try {
        const userResponse = await fetch('/api/get-current-user/');
        const userData = await userResponse.json();
        const contentType = userResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned invalid data or you have been logged out.');
        }
        if (userData.success) {
            userOffice = userData.office;
        }
    } catch (error) {
        console.error('Error getting user office:', error);
    }

    // Nếu không có office, không cho phép mua
    if (!userOffice) {
        alert('Cannot determine your office. Please contact admin.');
        return null;
    }
    return userOffice;
}
getUserOffice();

// Biến toàn cục để lưu trữ dữ liệu API
let apiData = {};
// Hàm lấy dữ liệu API với callback
function getApiData(callback) {
    $.ajax({
        url: '/api/get-apikey/',
        method: 'GET',
        success: function(response) {
            if (response.success) {
                apiData = response.api_data;
                // console.log('apiData', apiData);
                if (typeof callback === 'function') callback();
            } else {
                console.error('Error when getting API data:', response.error);
            }
        },
        error: function(xhr, status, error) {
            console.error('Error when calling API:', error);
        }
    });
}


// --- Lấy số lượng mail dự trữ ---
async function updateReserveMailCount() {
    // Kiểm tra userOffice trước
    if (!userOffice) {
        userOffice = await getUserOffice();
        if (!userOffice) {
            console.error('Cannot get office information');
            return;
        }
    }

    try {
        const response = await fetch('/api/reserve-mails-count/?office=' + userOffice);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new TypeError("Response was not JSON");
        }
        
        const data = await response.json();
        
        const reserveMailCount = document.getElementById('reserveMailCount');
        if (!reserveMailCount) {
            console.warn('Element reserveMailCount not found');
            return;
        }
        
        if (data.success) {
            reserveMailCount.textContent = data.available_count;
        } else {
            console.error('Error getting reserve mail count:', data.error || 'Unknown error');
            reserveMailCount.textContent = '?';
        }
    } catch (error) {
        console.error('Error fetching reserve mail count:', error);
        const reserveMailCount = document.getElementById('reserveMailCount');
        if (reserveMailCount) {
            reserveMailCount.textContent = '?';
        }
    }
}

// Thêm hàm để khởi tạo và cập nhật định kỳ
function initializeReserveMailCount() {
    // Gọi lần đầu khi trang load

    // Cập nhật số lượng mail dự trữ mỗi 60 giây
    // const updateInterval = setInterval(updateReserveMailCount, 60000);

    // updateApiBalances();
    updateReserveMailCount();
    setInterval(updateApiBalances, 120000);
    setInterval(updateReserveMailCount, 120000);
    // Cleanup khi rời trang
    // window.addEventListener('beforeunload', () => {
    //     clearInterval(updateInterval);
    // });
}

// Lấy cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/\//g, '-');
}

function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    try {
        // Xử lý MongoDB-style date object
        if (typeof dateString === 'object' && dateString.$date) {
            dateString = dateString.$date;
        }
        
        // Nếu là đối tượng Date
        if (dateString instanceof Date) {
            const day = String(dateString.getDate()).padStart(2, '0');
            const month = String(dateString.getMonth() + 1).padStart(2, '0');
            const year = dateString.getFullYear();
            return `${day}/${month}/${year}`;
        }
        
        // Nếu là chuỗi
        if (typeof dateString === 'string') {
            // Nếu đã là định dạng DD-MM-YYYY hoặc DD/MM/YYYY thì chuyển sang DD/MM/YYYY
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
                return dateString.replace(/-/g, '/');
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
                return dateString;
            }
            
            // Xử lý chuỗi ISO string
            if (dateString.includes('T')) {
                dateString = dateString.split('T')[0];
            }
        } else {
            dateString = String(dateString);
        }
        
        // Tạo đối tượng Date từ input
        const date = new Date(dateString);
        
        // Kiểm tra nếu date không hợp lệ
        if (isNaN(date.getTime())) {
            console.warn('Invalid date format:', dateString);
            return 'Invalid Date';
        }
        
        // Lấy ngày, tháng, năm
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const result = `${day}/${month}/${year}`;
        return result;
    } catch (error) {
        console.warn('Error formatting date:', error, 'Input:', dateString);
        return 'Error';
    }
}

// Hàm sanitize dữ liệu để tránh lỗi JSON
function sanitizeData(data) {
    try {
        // Xử lý null/undefined
        if (data === null || data === undefined) {
            return '';
        }
        
        // Xử lý string
        if (typeof data === 'string') {
            return data.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
        }
        
        // Xử lý number, boolean
        if (typeof data === 'number' || typeof data === 'boolean') {
            return String(data);
        }
        
        // Xử lý object (convert to string)
        if (typeof data === 'object') {
            return JSON.stringify(data).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
        }
        
        // Fallback
        return String(data);
    } catch (error) {
        console.warn('Error sanitizing data:', error, data);
        return '';
    }
}

function getStatusClass(status) {
    try {
        // Xử lý null/undefined
        if (!status) {
            return 'status-default';
        }
        
        // Chuyển về string và lowercase
        const statusStr = String(status).toLowerCase().trim();
        
        switch(statusStr) {
            case 'verified':
                return 'status-verified';
            case 'success':
                return 'status-success';
            case 'error':
                return 'status-error';
            case 'resend link':
                return 'status-resend-link';
            case 'other password':
            case 'not reg':
                return 'status-not-reg';
            default:
                console.warn('Unknown status:', status);
                return 'status-default';
        }
    } catch (error) {
        console.warn('Error getting status class:', error, status);
        return 'status-default';
    }
}


async function copyTextNowInfo(ev, full_information) {
    try {
        let textToCopy = '';
        if (full_information !== null && full_information !== undefined) {
            textToCopy = String(full_information);
        }
        if (ev && typeof ev.preventDefault === 'function') {
            ev.preventDefault();
            ev.stopPropagation();
        }

        let success = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                success = true;
            } catch (_) {
                success = false;
            }
        }
        if (!success) {
            const tempInput = document.createElement('textarea');
            tempInput.value = textToCopy;
            document.body.appendChild(tempInput);
            tempInput.select();
            try {
                success = document.execCommand('copy');
            } catch (_) {
                success = false;
            }
            document.body.removeChild(tempInput);
        }

        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = success ? 'Copied!' : 'Copy failed!';

        const e = ev || window.event;
        if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY - 25) + 'px';
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
    } catch (error) {
        console.error('Error copying text:', error);
        // Chỉ log, không alert để tránh gây khó chịu khi đã copy thành công
    }
}

function updateStatus(email, type, status) {
    const data = {
        email: email
    };
    
    if (type === 'tn') {
        data.status_account_TN = status;
    } else if (type === 'tf') {
        data.status_account_TF = status;
    }

    fetch('/api/update-textnow-status/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hiển thị thông báo thành công
            const tooltip = document.createElement('div');
            tooltip.className = 'copy-tooltip';
            tooltip.textContent = 'Updated successfully!';
            
            const event = window.event;
            tooltip.style.left = (event.clientX + 10) + 'px';
            tooltip.style.top = (event.clientY - 25) + 'px';
            
            document.body.appendChild(tooltip);
            tooltip.style.display = 'block';

            setTimeout(() => {
                document.body.removeChild(tooltip);
            }, 1000);
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred when updating status');
    });
}

function showNotification(message, type = 'success') {
    let popup = document.getElementById('notificationPopup');

    // Nếu popup chưa tồn tại, tạo mới với cấu trúc đầy đủ
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
    }

    // Đảm bảo cấu trúc bên trong tồn tại
    if (!popup.querySelector('.notification-message') || !popup.querySelector('.notification-icon i')) {
        popup.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon"><i class="fas fa-check-circle"></i></div>
                <div class="notification-message"></div>
            </div>`;
    }

    const icon = popup.querySelector('.notification-icon i');
    const messageElement = popup.querySelector('.notification-message');
    if (!icon || !messageElement) {
        console.warn('Notification popup structure missing, skipping notification');
        return;
    }

    // Cập nhật nội dung
    messageElement.textContent = message;

    // Cập nhật icon và màu sắc
    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
        icon.parentElement.className = 'notification-icon success';
    } else {
        icon.className = 'fas fa-times-circle';
        icon.parentElement.className = 'notification-icon error';
    }

    // Hiển thị popup
    popup.style.display = 'block';

    // Tự động ẩn sau 3 giây
    setTimeout(() => {
        popup.classList.add('hide');
        setTimeout(() => {
            popup.style.display = 'none';
            popup.classList.remove('hide');
        }, 300);
    }, 3000);
}

function updateMultipleStatus(status) {
    // console.log('updateMultipleStatus');
    const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
    const emails = Array.from(selectedRows).map(checkbox => checkbox.value);
    // console.log('updateMultipleStatus emails:', emails)
    if (emails.length === 0) {
        showNotification('Please select at least one record', 'error');
        return;
    }
    
    // Xác định loại status dựa trên trạng thái hiện tại
    const statusType = isTextNowStatus ? 'TN' : 'TF';
    const statusField = isTextNowStatus ? 'status_account_TN' : 'status_account_TF';
    
    const confirmMessage = status === 'verified' 
        ? `Are you sure you want to mark ${emails.length} records as "Verified" for ${statusType}?`
        : `Are you sure you want to mark ${emails.length} records as "Error" for ${statusType}?`;
    if (!confirm(confirmMessage)) {
        return;
    }
    const successButton = document.getElementById('btnVerifiedSuccess');
    const errorButton = document.getElementById('btnVerifiedError');
    const originalSuccessText = successButton.innerHTML;
    const originalErrorText = errorButton.innerHTML;
    const activeButton = status === 'verified' ? successButton : errorButton;
    const inactiveButton = status === 'verified' ? errorButton : successButton;
    activeButton.disabled = true;
    inactiveButton.disabled = true;
    activeButton.innerHTML = `
        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        Processing...`;
    
    const promises = emails.map(email => {
        const requestBody = {
            email: email,
            [statusField]: status
        };
        
        return fetch('/api/verified-textnow-update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify(requestBody)
        }).then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json().then(data => ({ email, data }));
        });
    });
    Promise.all(promises)
        .then(results => {
            let successCount = 0;
            let errorCount = 0;
            results.forEach(result => {
                if (result.data.success) {
                    successCount++;
                    // Cập nhật lại dòng trên bảng (không reload)
                    // console.log('updateRowStatusInTable');
                    updateRowStatusInTable(result.email, status, statusType);
                } else {
                    errorCount++;
                }
            });
            if (successCount > 0) {
                showNotification(`Updated successfully ${successCount} records for ${statusType}`);
            }
            if (errorCount > 0) {
                showNotification(`Failed to update ${errorCount} records for ${statusType}`, 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification(`An error occurred when updating ${statusType} status: ${error.message}`, 'error');
        })
        .finally(() => {
            activeButton.disabled = false;
            inactiveButton.disabled = false;
            activeButton.innerHTML = originalSuccessText;
            errorButton.innerHTML = originalErrorText;
        });
}

// Hàm cập nhật lại trạng thái TN/TF cho dòng trên bảng (không reload)
function updateRowStatusInTable(email, newStatus, statusType = 'TN') {
    const tableBody = document.getElementById('verifiedTableBody');
    const rows = tableBody.querySelectorAll('tr');
    let updatedRow = null;
    
    rows.forEach(row => {
        // Sau khi xóa 2 cột mật khẩu, cột email là cột thứ 3
        const emailCell = row.querySelector('td:nth-child(3)');
        if (emailCell && emailCell.textContent.trim() === email) {
            // Cập nhật badge trạng thái dựa trên loại status
            let statusCell;
            if (statusType === 'TN') {
                // Cập nhật badge trạng thái TN (cột thứ 5)
                statusCell = row.querySelector('td:nth-child(5) .status-badge');
            } else {
                // Cập nhật badge trạng thái TF (cột thứ 6)
                statusCell = row.querySelector('td:nth-child(6) .status-badge');
            }
            
            if (statusCell) {
                statusCell.textContent = newStatus;
                statusCell.className = 'status-badge ' + getStatusClass(newStatus);
            }
            
            // Disable checkbox nếu status là 'verified'
            if (newStatus === 'verified') {
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = true;
                }
            }
            updatedRow = row;
        }
    });
    if (updatedRow && newStatus === 'verified') {
        updatedRow.classList.remove('reg-ok-row');
    }
}

// Thêm hàm xử lý select all
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('input[name="recordCheckbox"]:not(:disabled)');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const row = checkbox.closest('tr');
        if (selectAllCheckbox.checked) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    toggleActionButtons();
}

function toggleActionButtons() {
    const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
    const btnVerifiedSuccess = document.getElementById('btnVerifiedSuccess');
    const btnVerifiedError = document.getElementById('btnVerifiedError');
    const btnCopyAll = document.getElementById('btnCopyAll');
    
    if (selectedRows.length > 0) {
        btnVerifiedSuccess.style.display = 'inline-block';
        btnVerifiedError.style.display = 'inline-block';
        btnCopyAll.style.display = 'inline-block';
    } else {
        btnVerifiedSuccess.style.display = 'none';
        btnVerifiedError.style.display = 'none';
        btnCopyAll.style.display = 'none';
    }
}

function displayVerifiedRecords(records) {
    const tableBody = document.getElementById('verifiedTableBody');
    tableBody.innerHTML = '';

    const safeRecords = Array.isArray(records)
        ? records.filter(record => record && typeof record === 'object' && 'email' in record)
        : [];

    if (safeRecords.length > 0) {
        let html = '';
        for (let idx = 0; idx < safeRecords.length; idx++) {
            const record = safeRecords[idx];
            try {
                const isVerified = record.status_account_TN === 'verified';
                const isRegOk = record.status_account_TN === 'success' || record.status_account_TN === 'resend link' || record.status_account_TN === 'not reg' || record.status_account_TN === 'error';
                const safeEmail = sanitizeData(record.email || '');
                const safePasswordEmail = sanitizeData(record.password_email || '');
                const safePassTN = sanitizeData(record.pass_TN || '');
                const safeFullInfo = sanitizeData(record.full_information || '');
                const safeCreatedBy = sanitizeData(record.created_by || '');
                const safeStatusTN = sanitizeData(record.status_account_TN || '');
                const safeStatusTF = sanitizeData(record.status_account_TF || '');
                const rowNum = safeRecords.length - idx;
                html += `
                    <tr class="selectable-row ${isRegOk ? 'reg-ok-row' : ''}" data-email="${safeEmail}">
                        <td>
                            <input type="checkbox" name="recordCheckbox" value="${safeEmail}" 
                                class="form-check-input" onchange="handleCheckboxChange(this)"
                                data-full-info="${safeFullInfo}"
                                ${isVerified ? 'disabled' : ''}>
                        </td>
                        <td>${rowNum}</td>
                        <td>${safeEmail}</td>
                        <td>${safePassTN}</td>
                        <td>
                            <span class="status-badge ${getStatusClass(safeStatusTN)}">
                                ${safeStatusTN}
                            </span>
                        </td>
                        <td>
                            <span class="status-badge ${getStatusClass(safeStatusTF)}">
                                ${safeStatusTF}
                            </span>
                        </td>
                        <td>${formatDateToDDMMYYYY(record.created_at)}</td>
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
                    </tr>
                `;
            } catch (error) {
                console.error('Error creating row for record:', error, record);
                html += `
                    <tr class="table-danger">
                        <td colspan="9" class="text-center text-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Error displaying record: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
        tableBody.innerHTML = html;
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    No valid records found
                </td>
            </tr>
        `;
    }

    // Reset select all checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    toggleActionButtons();
}

// Event delegation for row click to toggle selection
(function setupRowDelegation() {
    const tableBody = document.getElementById('verifiedTableBody');
    if (!tableBody) return;
    tableBody.addEventListener('click', function(e) {
        if (e.target.closest('input') || e.target.closest('button')) return;
        const row = e.target.closest('tr');
        if (!row) return;
        const checkbox = row.querySelector('input[name="recordCheckbox"]');
        if (checkbox && !checkbox.disabled) {
            checkbox.checked = !checkbox.checked;
            handleCheckboxChange(checkbox);
        }
    });
})();

// Thêm event listener cho nút Copy All
document.getElementById('btnCopyAll').addEventListener('click', function() {
    copyAllSelected();
});

// Thêm event listener cho checkbox Select All
document.getElementById('selectAll').addEventListener('change', function() {
    toggleSelectAll();
});

// Thêm các hàm JavaScript để xử lý modal
let currentEditEmail = '';
let currentEditStatusTN = '';
let currentEditStatusTF = '';
let isEditingTextNow = true; // true = TN, false = TF

function renderEditStatusOptions() {
    const statusSelect = document.getElementById('editStatus');
    const label = document.getElementById('editStatusLabel');
    if (!statusSelect || !label) return;
    statusSelect.innerHTML = '';
    if (isEditingTextNow) {
        label.textContent = 'TextNow Status: (click to switch)';
        const options = ['not reg', 'verified', 'error', 'resend link', 'success', 'other password'];
        options.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            statusSelect.appendChild(opt);
        });
        statusSelect.value = currentEditStatusTN || '';
    } else {
        label.textContent = 'TextFree Status: (click to switch)';
        const options = ['success', 'error', 'resend link', 'other password', 'not reg'];
        options.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
            statusSelect.appendChild(opt);
        });
        statusSelect.value = currentEditStatusTF || '';
           }
}

function editRecord(email, statusTN, statusTF) {
    currentEditEmail = email;
    currentEditStatusTN = statusTN || '';
    currentEditStatusTF = statusTF || '';
    
    const modal = document.getElementById('editModal');
    const emailElement = document.getElementById('editEmail');
    
           
    emailElement.textContent = email;
    // mặc định mở theo TextNow
    isEditingTextNow = true;
    renderEditStatusOptions();
    
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    const bootstrapModal = bootstrap.Modal.getInstance(modal);
    if (bootstrapModal) {
        bootstrapModal.hide();
    }
    currentEditEmail = '';
    currentEditStatusTN = '';
    currentEditStatusTF = '';
    isEditingTextNow = true;
}
// Các hàm xử lý modal
function closeAllModals() {
    const modals = [
        'mailListModal',
        'purchaseModal',
        'passwordModal',
        'confirmFetchModal',
        'passwordInputModal'
    ];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    });
    document.body.style.overflow = 'auto';
}

// Hàm xử lý checkbox
function handleCheckboxChange(checkbox) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        row.classList.add('selected');
    } else {
        row.classList.remove('selected');
    }
    toggleActionButtons();
}

function saveEdit() {
    const newStatus = document.getElementById('editStatus').value;
    const saveButton = document.querySelector('.modal-footer .btn-primary');
    const originalButtonText = saveButton.innerHTML;
    
    // Disable nút và hiển thị loading
    saveButton.disabled = true;
    saveButton.innerHTML = `
        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        Saving...
    `;
    
    const url = '/api/verified-textnow-update/';
    const body = isEditingTextNow 
        ? { email: currentEditEmail, status_account_TN: newStatus }
        : { email: currentEditEmail, status_account_TF: newStatus };

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hiển thị thông báo thành công
            const toast = document.createElement('div');
            toast.className = 'position-fixed top-0 end-0 p-3';
            toast.style.zIndex = '1050';
            toast.innerHTML = `
                <div class="toast align-items-center text-white bg-success border-0" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body">
                            <i class="fas fa-check-circle me-2"></i>
                            Updated status successfully!
                        </div>
                        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(toast);
            const toastElement = new bootstrap.Toast(toast.querySelector('.toast'));
            toastElement.show();

            // Refresh trang sau 1 giây
            setTimeout(() => {
                // Cập nhật tại chỗ để phản hồi nhanh, sau đó có thể gọi searchRecords()
                updateRowStatusInTable(currentEditEmail, newStatus, isEditingTextNow ? 'TN' : 'TF');
                searchRecords();
            }, 500);
        } else {
            alert('Error when updating: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('An error occurred when updating status');
    })
    .finally(() => {
        // Restore nút về trạng thái ban đầu
        saveButton.disabled = false;
        saveButton.innerHTML = originalButtonText;
        closeEditModal();
    });
}

// Đóng modal khi click bên ngoài
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target == modal) {
        closeEditModal();
    }
}

// Toggle TN/TF trong modal khi click label
document.addEventListener('DOMContentLoaded', function() {
    const label = document.getElementById('editStatusLabel');
    if (label) {
        label.addEventListener('click', function() {
            isEditingTextNow = !isEditingTextNow;
            renderEditStatusOptions();
        });
    }
});

// Thêm hàm để cập nhật dropdown người tạo
function updateCreatedByDropdown(creators, selectedValue = '') {
    const createdBySelect = document.getElementById('createdBy');
    // Giữ lại option "Tất cả"
    createdBySelect.innerHTML = '<option value="">All</option>';
    
    if (creators && creators.length > 0) {
        creators.forEach(creator => {
            const option = document.createElement('option');
            option.value = creator;
            option.textContent = creator;
            createdBySelect.appendChild(option);
        });
        
        // Khôi phục giá trị đã chọn
        if (selectedValue) {
            createdBySelect.value = selectedValue;
        }
    }
}

// Cập nhật hàm searchRecords để xử lý danh sách người tạo và hỗ trợ TextFree Status
function searchRecords() {
    const searchButton = document.getElementById('searchButton');
    const searchText = searchButton.querySelector('.search-text');
    const searchLoading = searchButton.querySelector('.search-loading');
    const createdBySelect = document.getElementById('createdBy');
    
    // Lưu giá trị đã chọn trước khi tìm kiếm
    const selectedCreator = createdBySelect.value;
    const selectedStatus = document.getElementById('statusTN').value;
    const selectedDate = document.getElementById('searchDate').value;
    
    // Disable nút và hiển thị loading
    searchButton.disabled = true;
    searchText.classList.add('d-none');
    searchLoading.classList.remove('d-none');

    const date = selectedDate;
    const statusValue = selectedStatus;
    const createdBy = selectedCreator;
    
    // Xây dựng URL với parameters
    const searchParams = new URLSearchParams();
    if (date) searchParams.append('date', date);
    if (createdBy) searchParams.append('created_by', createdBy);
    
    // Thêm parameter status dựa trên loại status hiện tại
    if (statusValue) {
        if (isTextNowStatus) {
            searchParams.append('status_account_TN', statusValue);
        } else {
            searchParams.append('status_account_TF', statusValue);
        }
    }
    
    // Gọi API search
    fetch(`/api/search-textnow/?${searchParams.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Cập nhật bảng với dữ liệu đã lọc
                displayVerifiedRecords(data.data);
                
                // Cập nhật dropdown người tạo nếu có dữ liệu mới
                if (data.creators) {
                    updateCreatedByDropdown(data.creators, selectedCreator);
                }
                // Khôi phục lại các giá trị đã chọn
                document.getElementById('statusTN').value = selectedStatus;
                document.getElementById('searchDate').value = selectedDate;
            } else {
                alert('An error occurred when searching');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred when searching');
        })
        .finally(() => {
            // Restore nút về trạng thái ban đầu
            searchButton.disabled = false;
            searchText.classList.remove('d-none');
            searchLoading.classList.add('d-none');
        });
}

// Thêm hàm copyAllSelected để xử lý copy nhiều records
function copyAllSelected() {
    const selectedRows = document.querySelectorAll('input[name="recordCheckbox"]:checked');
    const selectedFullInfos = Array.from(selectedRows).map(checkbox => {
        return checkbox.getAttribute('data-full-info') || '';
    }).filter(info => info);

    if (selectedFullInfos.length === 0) {
        alert('Please select at least one record');
        return;
    }

    // Tạo chuỗi text với dấu xuống dòng
    const textToCopy = selectedFullInfos.join('\n');
    
    // Copy vào clipboard (Clipboard API với fallback)
    (async () => {
        let success = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(textToCopy);
                success = true;
            } catch (_) { success = false; }
        }
        if (!success) {
            try {
                const tempInput = document.createElement('textarea');
                tempInput.value = textToCopy;
                document.body.appendChild(tempInput);
                tempInput.select();
                success = document.execCommand('copy');
                document.body.removeChild(tempInput);
            } catch (_) { success = false; }
        }

        // Hiển thị tooltip thông báo
        const tooltip = document.createElement('div');
        tooltip.className = 'copy-tooltip';
        tooltip.textContent = success
            ? `Copied ${selectedFullInfos.length} records!`
            : 'Copy failed!';

        const ev2 = window.event;
        if (ev2 && typeof ev2.clientX === 'number' && typeof ev2.clientY === 'number') {
            tooltip.style.left = (ev2.clientX + 10) + 'px';
            tooltip.style.top = (ev2.clientY - 25) + 'px';
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
    })();
}


// Lấy dữ liệu mặc định từ server (JSON string -> object)
let recordsToday = [];
document.addEventListener('DOMContentLoaded', function() {
    initializeReserveMailCount();
    getApiData(function() {
        updateApiBalances();
        // --- Lấy mail dự trữ ---
        const getReserveMailBtn = document.getElementById('getReserveMailBtn');
        if (getReserveMailBtn) {
            getReserveMailBtn.addEventListener('click', function() {
                showReserveMailModal();
            });
        }
        // Lấy ngày hiện tại set cho input searchDate
        const searchDateInput = document.getElementById('searchDate');
        if (searchDateInput && !searchDateInput.value) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            searchDateInput.value = `${yyyy}-${mm}-${dd}`;
        }
        closeAllModals();
        // Ensure recordsToday is an array before filtering
        if (!Array.isArray(recordsToday)) {
            console.warn('recordsToday is not an array, initializing as empty array');
            recordsToday = [];
        }
        // Tải trang đầu: ưu tiên các trạng thái 'success' và 'resend link'
        fetch(`/api/search-textnow/?page=1&page_size=2000&status_account_TN=success,resend%20link`)
            .then(res => res.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.data)) {
                    recordsToday = data.data;
                    displayVerifiedRecords(recordsToday);
                } else {
                    displayVerifiedRecords([]);
                }
            })
            .catch(() => displayVerifiedRecords([]));
        // BẮT SỰ KIỆN CHO BUTTON "Verified"
        const btnSuccess = document.getElementById('btnVerifiedSuccess');
        const btnError = document.getElementById('btnVerifiedError');
        if (btnSuccess) {
            btnSuccess.addEventListener('click', function() {
                updateMultipleStatus('verified');
            });
        }
        if (btnError) {
            btnError.addEventListener('click', function() {
                updateMultipleStatus('error');
            });
        }
    });
});

// Cleanup khi rời trang
// window.addEventListener('beforeunload', function() {
//     if (emailSocket) {
//         emailSocket.close();
//     }
// });

// === BẮT ĐẦU: JS xử lý Import, Xóa kho, Mua mail ===
// Hàm format date thành DD/MM/YYYY (dùng chung cho import và buy mail)
function formatDateDDMMYYYY(dateInput) {
    if (!dateInput) return null;
    
    // Nếu là string, thử parse
    let dateObj;
    if (typeof dateInput === 'string') {
        // Thử parse các format phổ biến
        // Format d/m/yyyy hoặc d/m/yy
        const dmyMatch = dateInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10);
            let year = parseInt(dmyMatch[3], 10);
            // Xử lý năm 2 chữ số
            if (year < 100) {
                year = year < 50 ? 2000 + year : 1900 + year;
            }
            dateObj = new Date(year, month - 1, day);
        } else {
            // Thử parse ISO format hoặc các format khác
            dateObj = new Date(dateInput);
        }
    } else if (dateInput instanceof Date) {
        dateObj = dateInput;
    } else {
        return null;
    }
    
    // Kiểm tra date hợp lệ
    if (isNaN(dateObj.getTime())) {
        return null;
    }
    
    // Format thành DD/MM/YYYY
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
}

// Lấy các button
const importMailBtn = document.getElementById('importMailBtn');
const importMailInput = document.getElementById('importMailInput');
const deleteAllEmailsBtn = document.getElementById('deleteAllEmailsBtn');
const buyDongVanBtn = document.getElementById('buyDongVanBtn');
const buyFMailBtn = document.getElementById('buyFMailBtn');
const buyPhapSuBtn = document.getElementById('buyPhapSuBtn');

// Thêm xử lý sự kiện cho nút Mua Mail Đồng Văn
if (buyDongVanBtn) {
    buyDongVanBtn.addEventListener('click', async function() {
        closeAllModals(); // Đóng tất cả modal trước khi mở modal mới
        const loadingOverlay = document.querySelector('.loading-overlay');
        const supplier = 'dongvan';
        loadingOverlay.style.display = 'flex';

        try {
            // Kiểm tra bản ghi employee password
            const checkResponse = await fetch('/api/check-employee-password-today/');
            const checkData = await checkResponse.json();
            
            if (!checkData.success) {
                throw new Error(checkData.error);
            }
            
            if (!checkData.has_record) {
                showModal('Please add TextNow and TextFree password before buying mail!');
                return;
            }

            // Nếu đã có bản ghi, tiếp tục lấy danh sách mail
            const response = await fetch(`https://api.dongvanfb.net/user/account_type?apikey=${apiData.api_dongvan}`);
            const data = await response.json();
            
            if (data.status && data.error_code === 200) {
                showMailListModal(data.data, supplier);
            } else {
                alert('Error when getting mail list: ' + data.message);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });
}

// Thêm xử lý sự kiện cho nút Mua Mail fMail
if (buyFMailBtn) {
    buyFMailBtn.addEventListener('click', async function() {
        closeAllModals(); // Đóng tất cả modal trước khi mở modal mới
        const loadingOverlay = document.querySelector('.loading-overlay');
        const supplier = 'fmail';
        loadingOverlay.style.display = 'flex';

        try {
            // Kiểm tra bản ghi employee password
            const checkResponse = await fetch('/api/check-employee-password-today/');
            const checkData = await checkResponse.json();
            
            if (!checkData.success) {
                throw new Error(checkData.error);
            }
            
            if (!checkData.has_record) {
                showModal('Please add TextNow and TextFree password before buying mail!');
                return;
            }

            // Nếu đã có bản ghi, tiếp tục lấy danh sách mail
            const response = await fetch(`/api/fmail-list/?apikey=${apiData.api_fmail}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                showMailListModal(data.data, supplier);
            } else {
                throw new Error(data.error || 'Error when getting mail list');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });
}

// Thêm xử lý sự kiện cho nút Mua Mail Pháp Sư
if (buyPhapSuBtn) {
    buyPhapSuBtn.addEventListener('click', async function() {
        closeAllModals(); // Đóng tất cả modal trước khi mở modal mới
        const loadingOverlay = document.querySelector('.loading-overlay');
        const supplier = 'phapsu';
        loadingOverlay.style.display = 'flex';

        try {
            // Kiểm tra bản ghi employee password
            const checkResponse = await fetch('/api/check-employee-password-today/');
            const checkData = await checkResponse.json();
            
            if (!checkData.success) {
                throw new Error(checkData.error);
            }
            
            if (!checkData.has_record) {
                showModal('Please add TextNow and TextFree password before buying mail!');
                return;
            }

            // Nếu đã có bản ghi, tiếp tục lấy danh sách mail
            // TODO: Thay API URL này bằng API thực tế cho Pháp Sư
            const response = await fetch(`/api/phapsu-list/?apikey=${apiData.api_phapsu}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                showMailListModal(data.data, supplier);
            } else {
                throw new Error(data.error || 'Error when getting mail list');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        } finally {
            loadingOverlay.style.display = 'none';
        }
    });
}
// --- Import Mail ---
if (importMailBtn && importMailInput) {
    importMailBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showImportOptionsModal();
    });
}

function showImportOptionsModal() {
    const modal = document.getElementById('importOptionsModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeImportOptionsModal() {
    const modal = document.getElementById('importOptionsModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function handleImportOption(option) {
    closeImportOptionsModal();
    // Lưu option đã chọn vào data attribute
    importMailInput.setAttribute('data-import-type', option);
    
    // Tạo và hiển thị modal chứa textarea
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '80%';
    modalContent.style.maxWidth = '600px';

    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '200px';
    textarea.style.marginBottom = '10px';
    textarea.style.padding = '10px';
    if (option === 'icloud') {
        textarea.placeholder = 'Enter icloud list in the format:\nid|password|numberphone|otp_link\nExample:\ncorennor786@icloud.com|Zxcv16789@|8144715589|https://sms222.us?token=0eXC9idaM109270030';
    } else if (option === 'gmail_recovery') {
        textarea.placeholder = 'Enter Gmail Recovery list in the format:\ngmail|password|gmail_recovery OR gmail|password\nExample:\nexample@gmail.com|Passw0rd!|recovery@gmail.com\nexample@gmail.com|Passw0rd!';
    } else {
        textarea.placeholder = 'Enter email list in the format:\nemail|password|token|client_id';
    }

    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Confirm';
    submitButton.className = 'btn btn-primary';

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'btn btn-secondary';

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(submitButton);
    modalContent.appendChild(textarea);
    modalContent.appendChild(buttonContainer);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Xử lý sự kiện khi nhấn nút Xác nhận
    submitButton.onclick = function() {
        const content = textarea.value.trim();
        
        // Kiểm tra input trống
        if (!content) {
            alert('Please enter data into the textarea!');
            return;
        }

        // Kiểm tra định dạng dữ liệu
        const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
        let hasError = false;
        let errorMessage = '';

        if (option === 'icloud') {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.split('|');
                if (parts.length < 4) {
                    errorMessage = `Line ${i + 1}: Missing information. Need 4 parts: id|password|numberphone|otp_link`;
                    hasError = true;
                    break;
                }
                const id = parts[0].trim();
                const password = parts[1].trim();
                const numberphone = parts[2].trim();
                const otpLink = parts[3].trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(id)) {
                    errorMessage = `Line ${i + 1}: Invalid icloud id (email): ${id}`;
                    hasError = true;
                    break;
                }
                if (!password) {
                    errorMessage = `Line ${i + 1}: Password cannot be empty`;
                    hasError = true;
                    break;
                }
                if (!numberphone || !/^\d{7,15}$/.test(numberphone)) {
                    errorMessage = `Line ${i + 1}: Invalid numberphone: ${numberphone}`;
                    hasError = true;
                    break;
                }
                try {
                    new URL(otpLink);
                } catch (_) {
                    errorMessage = `Line ${i + 1}: Invalid otp_link URL`;
                    hasError = true;
                    break;
                }
            }
        } else if (option === 'gmail_recovery') {
            // Already validated above; no additional checks here to avoid duplication
        } else {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const parts = line.split('|');
                if (parts.length < 4) {
                    errorMessage = `Line ${i + 1}: Missing information. Need 4 parts: email|password|token|client_id`;
                    hasError = true;
                    break;
                }
                const email = parts[0].trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    errorMessage = `Line ${i + 1}: Invalid email: ${email}`;
                    hasError = true;
                    break;
                }
                if (!parts[1].trim()) {
                    errorMessage = `Line ${i + 1}: Password cannot be empty`;
                    hasError = true;
                    break;
                }
            }
        }

        if (hasError) {
            alert(errorMessage);
            return;
        }

        // Nếu không có lỗi, tiếp tục xử lý
        if (option === 'icloud') {
            // Parse to objects
            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            const items = lines.map(line => {
                const [id, password, numberphone, otp_link] = line.split('|');
                return {
                    id: id.trim(),
                    password: password.trim(),
                    numberphone: numberphone.trim(),
                    otp_link: otp_link.trim()
                };
            });

            // Send to backend
            fetch('/api/save-icloud-accounts/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    accounts: items,
                    office: userOffice
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(`Imported ${data.inserted_count} icloud account(s) successfully!` + (data.duplicate_ids?.length ? `\nDuplicates skipped: ${data.duplicate_ids.length}` : ''));
                    document.body.removeChild(modal);
                } else {
                    alert(data.error || 'Failed to import icloud accounts');
                }
            })
            .catch(err => {
                console.error('Error importing icloud:', err);
                alert('An error occurred while importing icloud accounts');
            })
            .finally(() => {
                updateReserveMailCount && updateReserveMailCount();
            });
            return;
        } else if (option === 'gmail_recovery') {
            // Validate Gmail Recovery format: gmail|password|gmail_recovery OR gmail|password
            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].split('|');
                if (parts.length < 2) {
                    alert(`Line ${i + 1}: Missing information. Need at least 2 parts: gmail|password`);
                    return;
                }
                const gmail = parts[0].trim();
                const password = parts[1].trim();
                const recovery = (parts[2] || '').trim();
                if (!emailRegex.test(gmail)) {
                    alert(`Line ${i + 1}: Invalid gmail: ${gmail}`);
                    return;
                }
                if (!password) {
                    alert(`Line ${i + 1}: Password cannot be empty`);
                    return;
                }
                if (recovery && !emailRegex.test(recovery)) {
                    alert(`Line ${i + 1}: Invalid gmail_recovery: ${recovery}`);
                    return;
                }
            }

            const items = lines.map(line => {
                const parts = line.split('|');
                const email = (parts[0] || '').trim();
                const pwd = (parts[1] || '').trim();
                const recovery = (parts[2] || '').trim();
                const fullInfo = recovery ? `${email}|${pwd}|${recovery}` : `${email}|${pwd}`;
                return {
                    email: email,
                    password_email: pwd,
                    gmail_recovery: recovery,
                    created_at: new Date().toISOString(),
                    office: userOffice,
                    status: 'chưa sử dụng',
                    type_mail: 'gmail_recovery',
                    full_infomation: fullInfo
                };
            });

            fetch('/api/save-gmail-recovery-accounts/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    accounts: items,
                    office: userOffice
                })
            })
            .then(async (res) => {
                const contentType = res.headers.get('content-type') || '';
                if (!res.ok || !contentType.includes('application/json')) {
                    const text = await res.text().catch(() => '');
                    throw new Error(`Request failed (HTTP ${res.status}). Response: ${text.slice(0, 200)}`);
                }
                return res.json();
            })
            .then(data => {
                if (data.success) {
                    let msg = `Imported ${data.inserted_count} Gmail Recovery account(s) successfully!`;
                    if (data.duplicate_emails && data.duplicate_emails.length) {
                        msg += `\nDuplicates skipped: ${data.duplicate_emails.length}`;
                    }
                    alert(msg);
                    document.body.removeChild(modal);
                } else {
                    alert(data.error || 'Failed to import Gmail Recovery accounts');
                }
            })
            .catch(err => {
                console.error('Error importing gmail_recovery:', err);
                alert(`An error occurred while importing Gmail Recovery accounts. ${err && err.message ? err.message : ''}`);
            })
            .finally(() => {
                updateReserveMailCount && updateReserveMailCount();
            });
            return;
        }

        // Flow cũ cho long_term/office
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], 'import.txt', { type: 'text/plain' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        importMailInput.files = dataTransfer.files;
        const event = new Event('change', { bubbles: true });
        importMailInput.dispatchEvent(event);
        document.body.removeChild(modal);
    };

    // Xử lý sự kiện khi nhấn nút Hủy
    cancelButton.onclick = function() {
        document.body.removeChild(modal);
    };
}

// Cập nhật lại event listener cho importMailInput
if (importMailInput) {
    importMailInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const importType = this.getAttribute('data-import-type');
        if (!importType) {
            alert('Please select import type');
            return;
        }

        importMailBtn.disabled = true;
        importMailBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importing...';

        const reader = new FileReader();
        
        reader.onerror = function() {
            console.error('Error reading file:', reader.error);
            alert('An error occurred when reading file. Please try again.');
            importMailBtn.disabled = false;
            importMailBtn.innerHTML = 'Import';
        };

        reader.onload = async function(evt) {
            try {
                if (!evt || !evt.target || !evt.target.result) {
                    throw new Error('Cannot read file content');
                }

                const text = evt.target.result;
                if (!text || typeof text !== 'string') {
                    throw new Error('Invalid file or empty');
                }

                // Kiểm tra định dạng dữ liệu
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                
                if (lines.length === 0) {
                    throw new Error('File has no data!');
                }

                // Kiểm tra định dạng dữ liệu
                const validFormat = lines.every(line => {
                    const parts = line.split('|');
                    return parts.length >= 4 && parts[0].includes('@') && parts[1].trim() !== '';
                });

                if (!validFormat) {
                    throw new Error('Invalid file format. Each line must have at least 4 parts: email|password|token|client_id');
                }

                // Lấy mật khẩu mặc định
                let passTn = '';
                let passTf = '';
                try {
                    const res = await fetch('/api/get-employee-passwords/');
                    const data = await res.json();
                    if (data.success) {
                        passTn = data.password;
                        passTf = data.pass_tf;
                    }
                } catch (error) {
                    console.error('Error getting passwords:', error);
                }

                const today = new Date();
                const formattedDate = formatDateDDMMYYYY(today);
                
                // Parse và validate dữ liệu email
                const emailsFromFile = lines.map(line => {
                    try {
                        const parts = line.split('|');
                        if (parts.length < 4) {
                            console.warn('Line has missing information:', line);
                            return null;
                        }

                        const [email, password_email, refreshToken, clientId, date] = parts;

                        // Validate email format
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(email?.trim())) {
                            console.warn('Invalid email:', email);
                            return null;
                        }

                        // Validate required fields
                        if (!email?.trim() || !password_email?.trim()) {
                            console.warn('Missing required information:', line);
                            return null;
                        }

                        // Format date từ file hoặc dùng date mặc định
                        let finalDate = formattedDate;
                        if (date?.trim()) {
                            const parsedDate = formatDateDDMMYYYY(date.trim());
                            if (parsedDate) {
                                finalDate = parsedDate;
                            } else {
                                console.warn('Invalid date format, using default date:', date);
                            }
                        }

                        // Tạo đối tượng email với các trường cần thiết
                        const emailObj = {
                            email: email.trim(),
                            password_email: password_email.trim(),
                            refresh_token: refreshToken?.trim() || '',
                            client_id: clientId?.trim() || '',
                            date: finalDate,
                            pass_TN: passTn,
                            pass_TF: passTf,
                            status_account_TN: 'new',
                            status_account_TF: 'new',
                            supplier: 'purchased',
                            area_phone: '',
                            created_at: new Date().toISOString(),
                            type_mail: importType
                        };

                        return emailObj;
                    } catch (error) {
                        console.error('Error parsing line:', line, error);
                        return null;
                    }
                }).filter(item => item !== null);

                if (emailsFromFile.length === 0) {
                    throw new Error('No valid data to import');
                }
                
                // Gửi dữ liệu lên server
                const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                const res = await fetch('/api/save-purchased-emails/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken
                    },
                    body: JSON.stringify({
                        emails: emailsFromFile,
                        office: userOffice,
                        import_type: importType,
                    })
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                if (data.success) {
                    let msg = "Import successfully!";
                    if (data.duplicate_emails && data.duplicate_emails.length > 0) {
                        msg += ` But ${data.duplicate_emails.length} email(s) were duplicates and not added.`;
                        msg += `\n` + data.duplicate_emails.join(', ');
                    }
                    alert(msg);
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'An error occurred');
                }

            } catch (error) {
                console.error('Error processing file:', error);
                alert(error.message || 'An error occurred when processing file');
            } finally {
                importMailBtn.disabled = false;
                importMailBtn.innerHTML = 'Import';
                updateReserveMailCount();
            }
        };

        try {
            reader.readAsText(file);
        } catch (error) {
            console.error('Error reading file:', error);
            alert('An error occurred when reading file. Please try again.');
            importMailBtn.disabled = false;
            importMailBtn.innerHTML = 'Import';
        }
    });
}

// --- Xóa kho mail mới ---
if (deleteAllEmailsBtn) {
    deleteAllEmailsBtn.addEventListener('click', async function() {
        if (!confirm('Are you sure you want to delete all new mail? This action cannot be undone!')) return;
        deleteAllEmailsBtn.disabled = true;
        deleteAllEmailsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Deleting...';
        
        try {
            const res = await fetch('/api/delete-all-employee-emails/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
            });
            const data = await res.json();
            if (data.success) {
                alert('Successfully deleted ' + data.deleted_count + ' emails!');
                window.location.reload();
            } else {
                alert('Failed to delete: ' + (data.error || 'An error occurred'));
            }
        } catch (err) {
            alert('Failed to delete!');
        } finally {
            deleteAllEmailsBtn.disabled = false;
            deleteAllEmailsBtn.innerHTML = 'Delete new mail';
        }
    });
}

// --- Mua Mail Đồng Văn, fMail, Pháp Sư ---
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function showMailListModal(mailList, supplier) {
    let modal = document.getElementById('mailListModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'mailListModal';
        modal.className = 'custom-modal';
        modal.innerHTML = '<div class="modal-content"><div class="modal-header"><i class="fas fa-envelope"></i><h4 class="modal-title">Mail List</h4><button type="button" class="btn-close" onclick="closeMailListModal()">&times;</button></div><div class="modal-body" id="mailListCards"></div></div>';
        document.body.appendChild(modal);
    }
    const cardsContainer = modal.querySelector('#mailListCards');
    cardsContainer.innerHTML = '';
    const sortedMailList = [...mailList].sort((a, b) => a.price - b.price);
    sortedMailList.forEach(mail => {
        const cardHtml = `
            <div class="mail-card-parent">
                <div class="mail-card" data-mail-id="${mail.id}">
                    <div class="glass"></div>
                    <div class="content">
                        <span class="title">${mail.name}</span>
                        <div class="details mail-details-flex">
                            <span class="price mail-price-highlight">${formatPrice(mail.price)}</span>
                            <span class="quantity mail-quantity">${mail.quality} mail</span>
                        </div>
                    </div>
                    <div class="bottom">
                        <button class="buy-button" 
                                onclick="buyMail(${mail.id}, '${supplier}')" 
                        >
                            Buy Now
                        </button>
                    </div>
                </div>
            </div>
        `;
        cardsContainer.insertAdjacentHTML('beforeend', cardHtml);
    });
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

let currentMailData = null;

async function buyMail(mailId, supplier) {
    try {
        const mailCard = document.querySelector(`.mail-card[data-mail-id="${mailId}"]`);
        if (!mailCard) {
            throw new Error('Cannot find mail information');
        }
        const mailName = mailCard.querySelector('.title').textContent;
        const priceText = mailCard.querySelector('.price').textContent;
        const price = parseInt(priceText.replace(/[^\d]/g, ''));
        const quantityText = mailCard.querySelector('.quantity').textContent;
        const maxQuantity = parseInt(quantityText);
        if (isNaN(price) || isNaN(maxQuantity)) {
            throw new Error('Invalid data');
        }
        showPurchaseModal(mailId, mailName, price, maxQuantity, supplier);
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred when opening the purchase form: ' + error.message);
    }
}

function showPurchaseModal(mailId, mailName, mailPrice, maxQuantity, supplier) {
    let modal = document.getElementById('purchaseModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'purchaseModal';
        modal.className = 'custom-modal';
        document.body.appendChild(modal);
    }
    // Giới hạn số lượng tối đa là 200
    const actualMaxQuantity = Math.min(maxQuantity, 200);
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <i class="fas fa-shopping-cart"></i>
                <h4 class="modal-title">Confirm purchase from ${supplier === 'dongvan' ? 'Dong Van' : supplier === 'fmail' ? 'fMail' : 'Phap Su'}</h4>
                <button type="button" class="btn-close" onclick="closePurchaseModal()"></button>
            </div>
            <div class="modal-body">
                <div class="purchase-info mb-4">
                    <div class="info-row">
                        <span class="label">Mail ID:</span>
                        <span class="value">#${mailId}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Mail Type:</span>
                        <span class="value">${mailName}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Price:</span>
                        <span class="value price-highlight">${formatPrice(mailPrice)}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label for="purchaseQuantity" class="form-label">Quantity to buy:</label>
                    <input type="number" class="form-control" id="purchaseQuantity" value="1" placeholder="Enter quantity">
                    <div class="total-price mt-3">
                        <span class="label">Total price:</span>
                        <span id="totalPrice" class="value price-highlight">${formatPrice(mailPrice)}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-modal btn-close-modal" onclick="closePurchaseModal()">Cancel</button>
                <button class="btn btn-modal btn-confirm-purchase" onclick="confirmPurchase()">Confirm purchase</button>
            </div>
        </div>
    `;
    currentMailData = {
        id: mailId,
        name: mailName,
        price: mailPrice,
        maxQuantity: actualMaxQuantity,
        supplier: supplier
    };
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    const quantityInput = document.getElementById('purchaseQuantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', function() {
            let value = parseInt(this.value) || 0;
            // if (value < 1) {
            //     this.value = 1;
            //     value = 1;
            // }
            // if (value > actualMaxQuantity) {
            //     this.value = actualMaxQuantity;
            //     value = actualMaxQuantity;
            // }
            const totalPrice = value * mailPrice;
            document.getElementById('totalPrice').textContent = formatPrice(totalPrice);
        });
    }
}

// Add sleep function implementation
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Consolidate common utilities under a single namespace without changing behavior
(function() {
    try {
        window.Utils = {
            getCookie: typeof getCookie === 'function' ? getCookie : undefined,
            formatDate: typeof formatDate === 'function' ? formatDate : undefined,
            formatDateToDDMMYYYY: typeof formatDateToDDMMYYYY === 'function' ? formatDateToDDMMYYYY : undefined,
            sanitizeData: typeof sanitizeData === 'function' ? sanitizeData : undefined,
            getStatusClass: typeof getStatusClass === 'function' ? getStatusClass : undefined,
            copyTextNowInfo: typeof copyTextNowInfo === 'function' ? copyTextNowInfo : undefined,
            showNotification: typeof showNotification === 'function' ? showNotification : undefined,
            sleep: typeof sleep === 'function' ? sleep : undefined
        };
    } catch (e) {
        // no-op: do not affect existing flows
    }
})();

async function confirmPurchase() {
    if (!currentMailData) return;
    const quantity = parseInt(document.getElementById('purchaseQuantity').value);
    // if (quantity < 1 || quantity > currentMailData.maxQuantity) {
    //     alert('Invalid quantity!');
    //     return;
    // }
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    try {
        // Lấy mật khẩu
        const passwordResponse = await fetch('/api/get-employee-passwords/');
        const passwordData = await passwordResponse.json();
        if (!passwordData.success) {
            alert('Please add TextNow and TextFree password before buying mail!');
            closePurchaseModal();
            return;
        }
        const defaultPassTN = passwordData.pass_TN;
        const defaultPassTF = passwordData.pass_TF;
        if (!defaultPassTN || !defaultPassTF || defaultPassTN.trim() === "" || defaultPassTF.trim() === "") {
            const missingPasswords = [];
            if (!defaultPassTN || defaultPassTN.trim() === "") missingPasswords.push("TextNow");
            if (!defaultPassTF || defaultPassTF.trim() === "") missingPasswords.push("TextFree");
            alert(`Please provide passwords for the following applications: ${missingPasswords.join(", ")}`);
            closePurchaseModal();
            return;
        }
        
        let response;
        let isRequesting = true; // Biến kiểm soát vòng lặp

        // Tạo và hiển thị popup loading
        const loadingPopup = document.createElement('div');
        loadingPopup.className = 'loading-popup';
        loadingPopup.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>Processing request...</p>
                <button id="cancelRequestBtn" class="cancel-btn">Cancel</button>
            </div>
        `;
        document.body.appendChild(loadingPopup);

        // Thêm event listener cho nút Cancel
        document.getElementById('cancelRequestBtn').addEventListener('click', function() {
            isRequesting = false;
            loadingPopup.remove();
        });

        if (currentMailData.supplier === 'dongvan') {
            let success = false;
            let retryCount = 0;
            const MAX_RETRIES = 500;
            
            while (isRequesting && !success && retryCount < MAX_RETRIES) {
                try {
                    const response = await fetch(`https://api.dongvanfb.net/user/buy?apikey=${apiData.api_dongvan}&account_type=${currentMailData.id}&quality=${quantity}&type=full`);
                    const responseData = await response.json();
                    if (responseData.message === 'Buy Success!') {
                        success = true;
                        data = responseData;  // Lưu response data để sử dụng sau
                        break;
                    }
                } catch (error) {
                    console.error('Error in request:', error);
                }
                retryCount++;
                await sleep(1000);
            }
            if (!success) {
                throw new Error(`Cannot buy mail from Dong Van after ${MAX_RETRIES} attempts`);
            }
        } else if (currentMailData.supplier === 'fmail') {
            let success = false;
            let retryCount = 0;
            const MAX_RETRIES = 500;
            
            while (isRequesting && !success && retryCount < MAX_RETRIES) {
                try {
                    response = await fetch(`/api/fmail-buy/?apikey=${apiData.api_fmail}`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `id=${currentMailData.id}&amount=${quantity}`
                    });
                    data = await response.json();
                    if (data.status === 'success') {
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.error('Error in request:', error);
                }
                retryCount++;
                await sleep(1000);
            }
            if (!success) {
                throw new Error(`Cannot buy mail from fMail after ${MAX_RETRIES} attempts`);
            }
        } else if (currentMailData.supplier === 'phapsu') {
            let success = false;
            let retryCount = 0;
            const MAX_RETRIES = 500;
            
            while (isRequesting && !success && retryCount < MAX_RETRIES) {
                try {
                    response = await fetch(`/api/phapsu-buy/?apikey=${apiData.api_phapsu}`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                        body: `id=${currentMailData.id}&amount=${quantity}`
                    });
                    data = await response.json();
                    if (data.status === 'success') {
                        success = true;
                        break;
                    }
                } catch (error) {
                    console.error('Error in request:', error);
                }
                retryCount++;
                await sleep(1000);
            }
            if (!success) {
                throw new Error(`Cannot buy mail from Phap Su after ${MAX_RETRIES} attempts`);
            }
        } else {
            throw new Error('Cannot determine mail supplier');
        }
        let listData;
        let account_balance = null;
        if ((data.status && data.error_code === 200) || data.status == 'success') {
            if (currentMailData.supplier === 'dongvan') {
                listData = data.data.list_data;
            } else if (currentMailData.supplier === 'fmail') {
                listData = data.data;
                const response_info = await fetch(`/api/fmail-balance/?apikey=${apiData.api_fmail}`);
                const data_info = await response_info.json();
                account_balance = data_info.data.money;
            } else if (currentMailData.supplier === 'phapsu') {
                listData = data.data;
                const response_info = await fetch(`/api/phapsu-balance/?apikey=${apiData.api_phapsu}`);
                const data_info = await response_info.json();
                account_balance = data_info.data.money;
            }
            const today = new Date();
            const formattedDate = formatDateDDMMYYYY(today);
            const newEmails = listData.map((item, index) => {
                const [email, password_email, refreshToken, clientId] = item.split('|');
                return {
                    email,
                    password_email,
                    refresh_token: refreshToken,
                    client_id: clientId,
                    status: 'chưa sử dụng',
                    pass_TN: defaultPassTN,
                    pass_TF: defaultPassTF,
                    status_account_TN: "new",
                    status_account_TF: "new",
                    supplier: currentMailData.supplier,
                    date: formattedDate,
                    office: userOffice,
                    is_provided: false
                };
            });
            
            await fetch('/api/save-purchased-emails/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({
                    emails: newEmails,
                    office: userOffice,
                    import_type: 'buymail'
                })
            });

            // Cập nhật số dư
            updateApiBalances && updateApiBalances();
            if (currentMailData.supplier === 'dongvan') {
                alert(`Successfully purchased ${quantity} mail!\nOrder code: ${data.data.order_code}\nRemaining balance: ${data.data.balance ? data.data.balance.toLocaleString('vi-VN') + ' VND' : ''}`);
            } else if (currentMailData.supplier === 'fmail') {
                let balanceMsg = account_balance !== undefined && account_balance !== null ? `\nRemaining balance: ${account_balance.toLocaleString('vi-VN')} VND` : '';
                alert(`Successfully purchased ${quantity} mail!\nOrder code: ${data.trans_id || ''}${balanceMsg}`);
            } else if (currentMailData.supplier === 'phapsu') {
                let balanceMsg = account_balance !== undefined && account_balance !== null ? `\nRemaining balance: ${account_balance.toLocaleString('vi-VN')} VND` : '';
                alert(`Successfully purchased ${quantity} mail!\nOrder code: ${data.trans_id || ''}${balanceMsg}`);
            }
            closeAllModals && closeAllModals();
        } else {
            throw new Error(data.message || 'Cannot buy mail');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'An error occurred when buying mail');
    } finally {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        
        // Xóa popup loading
        const loadingPopup = document.querySelector('.loading-popup');
        if (loadingPopup) {
            loadingPopup.remove();
        }
    }
}

function closePurchaseModal() {
    let modal = document.getElementById('purchaseModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentMailData = null;
    }
}

function closeMailListModal() {
    let modal = document.getElementById('mailListModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Cập nhật số dư các tài khoản
function updateApiBalances() {
    const dongvanBadge = document.getElementById('dongvanBalance');
    const fmailBadge = document.getElementById('fmailBalance');
    const phapsuBadge = document.getElementById('phapsuBalance');
    if (!dongvanBadge && !fmailBadge && !phapsuBadge) return;
    if (apiData.api_dongvan) {
        fetch(`/api/dongvan-balance/?apikey=${apiData.api_dongvan}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (dongvanBadge) dongvanBadge.textContent = data.data.money.toLocaleString('vi-VN') + ' VND';
                } else {
                    if (dongvanBadge) dongvanBadge.textContent = '?';
                }
            }).catch(() => {
                if (dongvanBadge) dongvanBadge.textContent = '?';
            });
    }
    if (apiData.api_fmail) {
        fetch(`/api/fmail-balance/?apikey=${apiData.api_fmail}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (fmailBadge) fmailBadge.textContent = data.data.money.toLocaleString('vi-VN') + ' VND';
                } else {
                    if (fmailBadge) fmailBadge.textContent = '?';
                }
            }).catch(() => {
                if (fmailBadge) fmailBadge.textContent = '?';
            });
    }
    if (apiData.api_phapsu) {
        fetch(`/api/phapsu-balance/?apikey=${apiData.api_phapsu}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (phapsuBadge) phapsuBadge.textContent = data.data.money.toLocaleString('vi-VN') + ' VND';
                } else {
                    if (phapsuBadge) phapsuBadge.textContent = '?';
                }
            }).catch(() => {
                if (phapsuBadge) phapsuBadge.textContent = '?';
            });
    }
}
// === KẾT THÚC: JS xử lý Import, Xóa kho, Mua mail ===

// --- Add Import Options Modal ---

// Thêm các hàm xử lý modal lấy mail dự trữ
function showReserveMailModal() {
    // console.log('showReserveMailModal');
    const modal = document.getElementById('reserveMailModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeReserveMailModal() {
    const modal = document.getElementById('reserveMailModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function confirmGetReserveMail() {
    const quantity = parseInt(document.getElementById('reserveQuantity').value);
    if (quantity < 1 || quantity > 200) {
        alert('Invalid quantity! Please enter a number between 1 and 200.');
        return;
    }

    getReserveMailBtn.disabled = true;
    getReserveMailBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Getting mail...';
    
    try {
        const response = await fetch('/api/get-reserve-mails/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({
                office: userOffice,
                quantity: quantity
            })
        });

        const data = await response.json();
        
        if (data.success) {
            alert(`Successfully got ${data.count} mail from reserve stock!`);
            window.location.reload();
        } else {
            throw new Error(data.error || 'An error occurred when getting reserve mail');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'An error occurred when getting reserve mail');
    } finally {
        getReserveMailBtn.disabled = false;
        getReserveMailBtn.innerHTML = 'Get reserve mail';
        closeReserveMailModal();
    }
}

// Chức năng chuyển đổi giữa TextNow Status và TextFree Status
let isTextNowStatus = true; // Biến để theo dõi trạng thái hiện tại

function toggleStatusLabel() {
    const statusLabel = document.getElementById('statusLabel');
    const statusSelect = document.getElementById('statusTN');
    
    if (isTextNowStatus) {
        // Chuyển sang TextFree Status
        statusLabel.textContent = 'TextFree Status: (click to switch)';
        isTextNowStatus = false;
        
        // Cập nhật options cho TextFree
        statusSelect.innerHTML = `
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="resend link">Resend link</option>
            <option value="other password">Other password</option>
            <option value="not reg">Not reg</option>
        `;
    } else {
        // Chuyển về TextNow Status
        statusLabel.textContent = 'TextNow Status: (click to switch)';
        isTextNowStatus = true;
        // Cập nhật options cho TextNow
        statusSelect.innerHTML = `
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="verified">Verified</option>
            <option value="error">Error</option>
            <option value="resend link">Resend link</option>
            <option value="other password">Other password</option>
            <option value="not reg">Not reg</option>
        `;
    }
    
    // Reset giá trị select về "All"
    statusSelect.value = '';
}

// Thêm event listener cho label
document.addEventListener('DOMContentLoaded', function() {
    const statusLabel = document.getElementById('statusLabel');
    if (statusLabel) {
        statusLabel.addEventListener('click', toggleStatusLabel);
    }
});

// Thêm hàm getLink để lấy link xác thực từ email
// Queue management cho xử lý song song có giới hạn
const processingButtons = new Set();
const requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 15; // Giới hạn 15 requests cùng lúc (backend hỗ trợ 20)

// Hàm xử lý queue
async function processQueue() {
    while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT_REQUESTS) {
        const task = requestQueue.shift();
        if (task) {
            activeRequests++;
            task().finally(() => {
                activeRequests--;
                processQueue(); // Tiếp tục xử lý queue
            });
        }
    }
}

// Hàm wrapper để thêm task vào queue
function queueGetLink(event, fullInfo) {
    const button = event && event.target ? event.target.closest('button') : null;
    
    // Kiểm tra nếu button này đang xử lý
    if (button && processingButtons.has(button)) {
        console.log('Button đang xử lý, bỏ qua click');
        return;
    }

    // Thêm vào queue
    requestQueue.push(() => getLink(event, fullInfo));
    
    // Bắt đầu xử lý queue
    processQueue();
}

async function getLink(event, fullInfo) {
    const button = event && event.target ? event.target.closest('button') : null;
    const originalHTML = button ? button.innerHTML : '';
    const originalClass = button ? button.className : '';
    let email = 'unknown'; // Khai báo email sớm để dùng trong catch block

    try {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        // Parse full_information để lấy email data
        if (!fullInfo || typeof fullInfo !== 'string') {
            throw new Error('Invalid full_information');
        }

        const parts = fullInfo.split('|');
        if (parts.length < 4) {
            throw new Error('Invalid email data format');
        }

        const [emailParsed, password_email, refresh_token, client_id] = parts.map(p => p.trim());
        email = emailParsed; // Gán giá trị email

        if (!email || !password_email || !refresh_token || !client_id) {
            throw new Error('Missing required fields');
        }

        // Thêm button vào set đang xử lý
        if (button) {
            processingButtons.add(button);
            button.disabled = true;
            button.className = 'btn btn-sm btn-secondary copy-btn';
            button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        }

        console.log(`[GetLink] Bắt đầu xử lý: ${email}`);

        // Gọi API để lấy link từ email với timeout 90s
        const formData = new FormData();
        formData.append('email_data', `${email}|${password_email}|${refresh_token}|${client_id}`);

        // Tạo AbortController để hỗ trợ timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 giây

        let response;
        try {
            response = await fetch('/api/get-code-tn/', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId); // Clear timeout nếu request hoàn thành trước

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('Request timeout sau 90 giây');
            }
            throw fetchError;
        }

        const data = await response.json();
        const results = data.results;

        if (results && results.results && Array.isArray(results.results) && results.results.length > 0) {
            // Tìm link mới nhất
            const validLinks = results.results.filter(r => r.link && r.date);
            
            if (validLinks.length > 0) {
                // Sắp xếp theo thời gian giảm dần
                validLinks.sort((a, b) => new Date(b.date) - new Date(a.date));
                const latestLink = validLinks[0].link;

                // Tìm và cập nhật thẻ <a> tương ứng
                const linkId = 'link-' + email.replace(/[^a-zA-Z0-9]/g, '-');
                const linkElement = document.getElementById(linkId);
                
                if (linkElement) {
                    linkElement.href = latestLink;
                    linkElement.style.display = 'inline-block';
                }

                // Đổi màu button thành success
                if (button) {
                    button.className = 'btn btn-sm btn-success copy-btn';
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    
                    // Sau 1 giây, trở về trạng thái ban đầu
                    setTimeout(() => {
                        button.className = originalClass;
                        button.innerHTML = originalHTML;
                        button.disabled = false;
                        processingButtons.delete(button);
                    }, 1000);
                }

                console.log(`[GetLink] Thành công: ${email}`);
            } else {
                throw new Error('Không tìm thấy link xác thực trong email');
            }
        } else {
            const errorMsg = results && results.error ? results.error : 'Không thể đọc email lúc này';
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error(`[GetLink] Lỗi (${email}):`, error);
        
        // Restore button về trạng thái ban đầu NGAY LẬP TỨC
        if (button) {
            button.className = originalClass;
            button.innerHTML = originalHTML;
            button.disabled = false;
            processingButtons.delete(button);
        }
    }
}
