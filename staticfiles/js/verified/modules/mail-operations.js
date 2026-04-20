/**
 * Mail Operations Module
 * Handles import, purchase, and management of mail accounts
 * @module MailOperations
 */

'use strict';

const MailOperations = (function() {
    // State
    let currentMailData = null;

    /**
     * Show import options modal
     */
    function showImportOptionsModal() {
        const modal = document.getElementById('importOptionsModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close import options modal
     */
    function closeImportOptionsModal() {
        const modal = document.getElementById('importOptionsModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    /**
     * Handle import option selection
     * @param {string} option - Import type ('icloud', 'gmail_recovery', 'long_term', 'office')
     */
    async function handleImportOption(option) {
        closeImportOptionsModal();

        // Create modal for textarea input
        const modal = document.createElement('div');
        modal.className = 'import-modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5); display: flex;
            justify-content: center; align-items: center; z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white; padding: 20px; border-radius: 5px;
            width: 80%; max-width: 600px;
        `;

        const textarea = document.createElement('textarea');
        textarea.style.cssText = 'width: 100%; height: 200px; margin-bottom: 10px; padding: 10px;';
        
        // Set placeholder based on import type
        const placeholders = {
            'icloud': 'Enter icloud list in the format:\nid|password|numberphone|otp_link\nExample:\ncorennor786@icloud.com|Zxcv16789@|8144715589|https://sms222.us?token=0eXC9idaM109270030',
            'gmail_recovery': 'Enter Gmail Recovery list in the format:\ngmail|password|gmail_recovery OR gmail|password\nExample:\nexample@gmail.com|Passw0rd!|recovery@gmail.com\nexample@gmail.com|Passw0rd!',
            'default': 'Enter email list in the format:\nemail|password|token|client_id'
        };
        textarea.placeholder = placeholders[option] || placeholders['default'];

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px;';

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

        // Handle submit
        submitButton.onclick = async function() {
            const content = textarea.value.trim();

            if (!content) {
                alert('Please enter data into the textarea!');
                return;
            }

            const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
            
            try {
                // Validate and process based on option
                if (option === 'icloud') {
                    await processICloudImport(lines, modal);
                } else if (option === 'gmail_recovery') {
                    await processGmailRecoveryImport(lines, modal);
                } else {
                    await processStandardImport(lines, option, modal);
                }
            } catch (error) {
                alert(error.message);
            }
        };

        cancelButton.onclick = function() {
            document.body.removeChild(modal);
        };
    }

    /**
     * Process iCloud import
     * @param {string[]} lines - Lines to import
     * @param {HTMLElement} modal - Modal element
     */
    async function processICloudImport(lines, modal) {
        // Validate format
        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].split('|');
            if (parts.length < 4) {
                throw new Error(`Line ${i + 1}: Missing information. Need 4 parts: id|password|numberphone|otp_link`);
            }

            const [id, password, numberphone, otpLink] = parts.map(p => p.trim());
            
            if (!Utils.isValidEmail(id)) {
                throw new Error(`Line ${i + 1}: Invalid icloud id (email): ${id}`);
            }
            if (!password) {
                throw new Error(`Line ${i + 1}: Password cannot be empty`);
            }
            if (!numberphone || !/^\d{7,15}$/.test(numberphone)) {
                throw new Error(`Line ${i + 1}: Invalid numberphone: ${numberphone}`);
            }
            try {
                new URL(otpLink);
            } catch (_) {
                throw new Error(`Line ${i + 1}: Invalid otp_link URL`);
            }
        }

        // Parse to objects
        const items = lines.map(line => {
            const [id, password, numberphone, otp_link] = line.split('|').map(p => p.trim());
            return { id, password, numberphone, otp_link };
        });

        // Send to backend
        const data = await ApiService.saveICloudAccounts(items);
        
        if (data.success) {
            let msg = `Imported ${data.inserted_count} icloud account(s) successfully!`;
            if (data.duplicate_ids?.length) {
                msg += `\nDuplicates skipped: ${data.duplicate_ids.length}`;
            }
            alert(msg);
            document.body.removeChild(modal);
            updateReserveMailCount();
        } else {
            throw new Error(data.error || 'Failed to import icloud accounts');
        }
    }

    /**
     * Process Gmail Recovery import
     * @param {string[]} lines - Lines to import
     * @param {HTMLElement} modal - Modal element
     */
    async function processGmailRecoveryImport(lines, modal) {
        // Validate format
        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].split('|');
            if (parts.length < 2) {
                throw new Error(`Line ${i + 1}: Missing information. Need at least 2 parts: gmail|password`);
            }

            const gmail = parts[0].trim();
            const password = parts[1].trim();
            const recovery = (parts[2] || '').trim();

            if (!Utils.isValidEmail(gmail)) {
                throw new Error(`Line ${i + 1}: Invalid gmail: ${gmail}`);
            }
            if (!password) {
                throw new Error(`Line ${i + 1}: Password cannot be empty`);
            }
            if (recovery && !Utils.isValidEmail(recovery)) {
                throw new Error(`Line ${i + 1}: Invalid gmail_recovery: ${recovery}`);
            }
        }

        const userOffice = ApiService.getUserOffice();

        // Parse to objects
        const items = lines.map(line => {
            const parts = line.split('|');
            const email = (parts[0] || '').trim();
            const pwd = (parts[1] || '').trim();
            const recovery = (parts[2] || '').trim();
            const fullInfo = recovery ? `${email}|${pwd}|${recovery}` : `${email}|${pwd}`;
            
            return {
                email,
                password_email: pwd,
                gmail_recovery: recovery,
                created_at: new Date().toISOString(),
                office: userOffice,
                status: 'chưa sử dụng',
                type_mail: 'gmail_recovery',
                full_infomation: fullInfo
            };
        });

        const data = await ApiService.saveGmailRecoveryAccounts(items);
        
        if (data.success) {
            let msg = `Imported ${data.inserted_count} Gmail Recovery account(s) successfully!`;
            if (data.duplicate_emails?.length) {
                msg += `\nDuplicates skipped: ${data.duplicate_emails.length}`;
            }
            alert(msg);
            document.body.removeChild(modal);
            updateReserveMailCount();
        } else {
            throw new Error(data.error || 'Failed to import Gmail Recovery accounts');
        }
    }

    /**
     * Process standard email import
     * @param {string[]} lines - Lines to import
     * @param {string} importType - Import type
     * @param {HTMLElement} modal - Modal element
     */
    async function processStandardImport(lines, importType, modal) {
        // Validate format
        for (let i = 0; i < lines.length; i++) {
            const parts = lines[i].split('|');
            if (parts.length < 4) {
                throw new Error(`Line ${i + 1}: Missing information. Need 4 parts: email|password|token|client_id`);
            }

            const email = parts[0].trim();
            if (!Utils.isValidEmail(email)) {
                throw new Error(`Line ${i + 1}: Invalid email: ${email}`);
            }
            if (!parts[1].trim()) {
                throw new Error(`Line ${i + 1}: Password cannot be empty`);
            }
        }

        // Get employee passwords
        let passTn = '';
        let passTf = '';
        try {
            const passData = await ApiService.getEmployeePasswords();
            if (passData.success) {
                passTn = passData.password || passData.pass_TN || '';
                passTf = passData.pass_tf || passData.pass_TF || '';
            }
        } catch (error) {
            console.error('Error getting passwords:', error);
        }

        const formattedDate = Utils.formatDateDDMMYYYY(new Date());
        const userOffice = ApiService.getUserOffice();

        // Parse and validate data
        const emailsFromFile = lines.map(line => {
            const parts = line.split('|');
            const [email, password_email, refreshToken, clientId, date] = parts;

            let finalDate = formattedDate;
            if (date?.trim()) {
                const parsedDate = Utils.formatDateDDMMYYYY(date.trim());
                if (parsedDate) {
                    finalDate = parsedDate;
                }
            }

            return {
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
        }).filter(item => item !== null);

        if (emailsFromFile.length === 0) {
            throw new Error('No valid data to import');
        }

        const data = await ApiService.savePurchasedEmails(emailsFromFile, importType);
        
        if (data.success) {
            let msg = "Import successfully!";
            if (data.duplicate_emails?.length > 0) {
                msg += ` But ${data.duplicate_emails.length} email(s) were duplicates and not added.`;
                msg += `\n` + data.duplicate_emails.join(', ');
            }
            alert(msg);
            document.body.removeChild(modal);
            window.location.reload();
        } else {
            throw new Error(data.error || 'An error occurred');
        }
    }

    /**
     * Delete all new emails
     */
    async function deleteAllEmails() {
        if (!confirm('Are you sure you want to delete all new mail? This action cannot be undone!')) {
            return;
        }

        const deleteBtn = document.getElementById('deleteAllEmailsBtn');
        const btnState = deleteBtn ? UIHelpers.setButtonLoading(deleteBtn, 'Deleting...') : null;

        try {
            const data = await ApiService.deleteAllEmployeeEmails();
            if (data.success) {
                alert('Successfully deleted ' + data.deleted_count + ' emails!');
                window.location.reload();
            } else {
                alert('Failed to delete: ' + (data.error || 'An error occurred'));
            }
        } catch (err) {
            alert('Failed to delete!');
        } finally {
            if (btnState) btnState.restore();
        }
    }

    /**
     * Show mail list modal for purchasing
     * @param {Array} mailList - List of available mail types
     * @param {string} supplier - Supplier name
     */
    function showMailListModal(mailList, supplier) {
        let modal = document.getElementById('mailListModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mailListModal';
            modal.className = 'custom-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <i class="fas fa-envelope"></i>
                        <h4 class="modal-title">Mail List</h4>
                        <button type="button" class="btn-close" onclick="MailOperations.closeMailListModal()">&times;</button>
                    </div>
                    <div class="modal-body" id="mailListCards"></div>
                </div>
            `;
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
                                <span class="price mail-price-highlight">${Utils.formatPrice(mail.price)}</span>
                                <span class="quantity mail-quantity">${mail.quality} mail</span>
                            </div>
                        </div>
                        <div class="bottom">
                            <button class="buy-button" onclick="MailOperations.buyMail(${mail.id}, '${supplier}')">
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

    /**
     * Close mail list modal
     */
    function closeMailListModal() {
        const modal = document.getElementById('mailListModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    /**
     * Buy mail - show purchase modal
     * @param {number} mailId - Mail type ID
     * @param {string} supplier - Supplier name
     */
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

            showPurchaseModal(mailId, mailName, price, Math.min(maxQuantity, 200), supplier);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred when opening the purchase form: ' + error.message);
        }
    }

    /**
     * Show purchase confirmation modal
     */
    function showPurchaseModal(mailId, mailName, mailPrice, maxQuantity, supplier) {
        let modal = document.getElementById('purchaseModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'purchaseModal';
            modal.className = 'custom-modal';
            document.body.appendChild(modal);
        }

        const supplierNames = {
            'dongvan': 'Dong Van',
            'fmail': 'fMail',
            'phapsu': 'Phap Su'
        };

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <i class="fas fa-shopping-cart"></i>
                    <h4 class="modal-title">Confirm purchase from ${supplierNames[supplier] || supplier}</h4>
                    <button type="button" class="btn-close" onclick="MailOperations.closePurchaseModal()"></button>
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
                            <span class="value price-highlight">${Utils.formatPrice(mailPrice)}</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="purchaseQuantity" class="form-label">Quantity to buy:</label>
                        <input type="number" class="form-control" id="purchaseQuantity" value="1" placeholder="Enter quantity">
                        <div class="total-price mt-3">
                            <span class="label">Total price:</span>
                            <span id="totalPrice" class="value price-highlight">${Utils.formatPrice(mailPrice)}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-modal btn-close-modal" onclick="MailOperations.closePurchaseModal()">Cancel</button>
                    <button class="btn btn-modal btn-confirm-purchase" onclick="MailOperations.confirmPurchase()">Confirm purchase</button>
                </div>
            </div>
        `;

        currentMailData = {
            id: mailId,
            name: mailName,
            price: mailPrice,
            maxQuantity: maxQuantity,
            supplier: supplier
        };

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Update total price on quantity change
        const quantityInput = document.getElementById('purchaseQuantity');
        if (quantityInput) {
            quantityInput.addEventListener('input', function() {
                const value = parseInt(this.value) || 0;
                const totalPrice = value * mailPrice;
                document.getElementById('totalPrice').textContent = Utils.formatPrice(totalPrice);
            });
        }
    }

    /**
     * Close purchase modal
     */
    function closePurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            currentMailData = null;
        }
    }

    /**
     * Confirm and process purchase
     */
    async function confirmPurchase() {
        if (!currentMailData) return;

        const quantity = parseInt(document.getElementById('purchaseQuantity').value);
        let isRequesting = true;

        UIHelpers.showLoading();

        // Create loading popup with cancel
        const loadingPopup = UIHelpers.showLoadingPopup('Processing request...', () => {
            isRequesting = false;
        });

        try {
            // Get passwords first
            const passwordData = await ApiService.getEmployeePasswords();
            if (!passwordData.success) {
                throw new Error('Please add TextNow and TextFree password before buying mail!');
            }

            const defaultPassTN = passwordData.pass_TN;
            const defaultPassTF = passwordData.pass_TF;

            if (!defaultPassTN?.trim() || !defaultPassTF?.trim()) {
                const missing = [];
                if (!defaultPassTN?.trim()) missing.push("TextNow");
                if (!defaultPassTF?.trim()) missing.push("TextFree");
                throw new Error(`Please provide passwords for: ${missing.join(", ")}`);
            }

            // Purchase from supplier
            let data;
            const MAX_RETRIES = 500;
            let success = false;
            let retryCount = 0;

            while (isRequesting && !success && retryCount < MAX_RETRIES) {
                try {
                    if (currentMailData.supplier === 'dongvan') {
                        data = await ApiService.buyDongVanMail(currentMailData.id, quantity);
                        if (data.message === 'Buy Success!') success = true;
                    } else if (currentMailData.supplier === 'fmail') {
                        data = await ApiService.buyFMail(currentMailData.id, quantity);
                        if (data.status === 'success') success = true;
                    } else if (currentMailData.supplier === 'phapsu') {
                        data = await ApiService.buyPhapSu(currentMailData.id, quantity);
                        if (data.status === 'success') success = true;
                    } else {
                        throw new Error('Unknown supplier');
                    }
                } catch (error) {
                    console.error('Error in request:', error);
                }
                
                if (!success) {
                    retryCount++;
                    await Utils.sleep(1000);
                }
            }

            if (!success) {
                throw new Error(`Cannot buy mail after ${MAX_RETRIES} attempts`);
            }

            // Process successful purchase
            let listData;
            let account_balance = null;

            if ((data.status && data.error_code === 200) || data.status === 'success') {
                if (currentMailData.supplier === 'dongvan') {
                    listData = data.data.list_data;
                } else if (currentMailData.supplier === 'fmail') {
                    listData = data.data;
                    const balanceData = await ApiService.getFMailBalance();
                    account_balance = balanceData.data?.money;
                } else if (currentMailData.supplier === 'phapsu') {
                    listData = data.data;
                    const balanceData = await ApiService.getPhapSuBalance();
                    account_balance = balanceData.data?.money;
                }

                const formattedDate = Utils.formatDateDDMMYYYY(new Date());
                const userOffice = ApiService.getUserOffice();

                const newEmails = listData.map(item => {
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

                await ApiService.savePurchasedEmails(newEmails, 'buymail');
                ApiService.updateAllBalances();

                // Show success message
                let successMsg = `Successfully purchased ${quantity} mail!`;
                if (currentMailData.supplier === 'dongvan') {
                    successMsg += `\nOrder code: ${data.data.order_code}`;
                    if (data.data.balance) {
                        successMsg += `\nRemaining balance: ${data.data.balance.toLocaleString('vi-VN')} VND`;
                    }
                } else {
                    if (data.trans_id) successMsg += `\nOrder code: ${data.trans_id}`;
                    if (account_balance !== null) {
                        successMsg += `\nRemaining balance: ${account_balance.toLocaleString('vi-VN')} VND`;
                    }
                }
                
                alert(successMsg);
                UIHelpers.closeAllModals();
            } else {
                throw new Error(data.message || 'Cannot buy mail');
            }

        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'An error occurred when buying mail');
        } finally {
            UIHelpers.hideLoading();
            UIHelpers.removeLoadingPopup(loadingPopup);
        }
    }

    /**
     * Buy mail from specific supplier
     * @param {string} supplier - Supplier name
     */
    async function buyFromSupplier(supplier) {
        UIHelpers.closeAllModals();
        UIHelpers.showLoading();

        try {
            // Check employee password first
            const checkData = await ApiService.checkEmployeePassword();
            
            if (!checkData.success) {
                throw new Error(checkData.error);
            }
            
            if (!checkData.has_record) {
                UIHelpers.showModal('Please add TextNow and TextFree password before buying mail!');
                return;
            }

            // Get mail list based on supplier
            let data;
            if (supplier === 'dongvan') {
                data = await ApiService.getDongVanMailList();
                if (data.status && data.error_code === 200) {
                    showMailListModal(data.data, supplier);
                } else {
                    throw new Error(data.message || 'Error getting mail list');
                }
            } else if (supplier === 'fmail') {
                data = await ApiService.getFMailList();
                if (data.success) {
                    showMailListModal(data.data, supplier);
                } else {
                    throw new Error(data.error || 'Error getting mail list');
                }
            } else if (supplier === 'phapsu') {
                data = await ApiService.getPhapSuList();
                if (data.success) {
                    showMailListModal(data.data, supplier);
                } else {
                    throw new Error(data.error || 'Error getting mail list');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        } finally {
            UIHelpers.hideLoading();
        }
    }

    /**
     * Show reserve mail modal
     */
    function showReserveMailModal() {
        const modal = document.getElementById('reserveMailModal');
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close reserve mail modal
     */
    function closeReserveMailModal() {
        const modal = document.getElementById('reserveMailModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    /**
     * Confirm getting reserve mail
     */
    async function confirmGetReserveMail() {
        const quantity = parseInt(document.getElementById('reserveQuantity').value);
        if (quantity < 1 || quantity > 200) {
            alert('Invalid quantity! Please enter a number between 1 and 200.');
            return;
        }

        const getReserveMailBtn = document.getElementById('getReserveMailBtn');
        const btnState = getReserveMailBtn ? UIHelpers.setButtonLoading(getReserveMailBtn, 'Getting mail...') : null;

        try {
            const data = await ApiService.getReserveMails(quantity);
            
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
            if (btnState) btnState.restore();
            closeReserveMailModal();
        }
    }

    /**
     * Update reserve mail count display
     */
    async function updateReserveMailCount() {
        try {
            const data = await ApiService.getReserveMailCount();
            
            // Handle both success and failure cases
            const countElement = document.getElementById('reserveMailCount');
            if (countElement) {
                if (data && data.success) {
                    countElement.textContent = data.count || 0;
                } else {
                    // Show 0 or keep existing value on failure
                    countElement.textContent = countElement.textContent === '...' ? '0' : countElement.textContent;
                }
            }
        } catch (error) {
            // Gracefully handle error - don't show error to user for non-critical feature
            console.warn('Error updating reserve mail count (non-critical):', error.message || error);
            const countElement = document.getElementById('reserveMailCount');
            if (countElement && countElement.textContent === '...') {
                countElement.textContent = '0';
            }
        }
    }

    // Public API
    return {
        showImportOptionsModal,
        closeImportOptionsModal,
        handleImportOption,
        deleteAllEmails,
        showMailListModal,
        closeMailListModal,
        buyMail,
        showPurchaseModal,
        closePurchaseModal,
        confirmPurchase,
        buyFromSupplier,
        showReserveMailModal,
        closeReserveMailModal,
        confirmGetReserveMail,
        updateReserveMailCount
    };
})();

// Export for module usage and global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MailOperations;
}
window.MailOperations = MailOperations;

// Global function for reserve mail count
window.updateReserveMailCount = MailOperations.updateReserveMailCount;
