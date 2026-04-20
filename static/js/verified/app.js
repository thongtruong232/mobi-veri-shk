/**
 * Verified Page - Main Script (Optimized)
 * Phase 2: JavaScript Optimization
 * Phase 4: State Management Integration
 * Phase 5: Security & Error Handling
 * Phase 6: UI/UX Enhancements
 *
 * This script serves as the main orchestrator for the verified page,
 * coordinating all modules and handling page initialization.
 *
 * Modules:
 * - Utils: Utility functions (formatting, validation, etc.)
 * - UIHelpers: UI notifications, modals, tooltips
 * - ClipboardManager: Copy operations
 * - ApiService: Centralized API calls
 * - TableManager: Table operations
 * - MailOperations: Import/purchase operations
 * - StateManager: Centralized state management (Phase 4)
 * - Security: XSS prevention, CSRF, input validation (Phase 5)
 * - ErrorHandler: Global error handling, retry mechanism (Phase 5)
 * - FormValidator: Form validation (Phase 5)
 * - Accessibility: ARIA, keyboard navigation, screen reader (Phase 6)
 * - LoadingStates: Skeleton loaders, progress indicators (Phase 6)
 *
 * @version 5.0.0
 */

"use strict";

// ==================== Initialize Error Handler Global Listeners ====================
// Must be done early to catch any initialization errors
if (typeof ErrorHandler !== "undefined") {
  ErrorHandler.initGlobalListeners();

  // Set global error callback to integrate with StateManager
  ErrorHandler.setGlobalErrorCallback((error, context) => {
    console.error(
      "[App] Global error caught:",
      error.getUserMessage(),
      context,
    );
    // StateManager and UIHelpers are handled in ErrorHandler.handleError
  });
}

// ==================== Initialize Accessibility ====================
if (typeof Accessibility !== "undefined") {
  // Will be fully initialized after DOM ready in UIHelpers.init()
  console.log("[App] Accessibility module loaded");
}

// ==================== Legacy AppState (for backward compatibility) ====================
// This is a proxy to StateManager for components that still use AppState directly
const AppState = {
  get userOffice() {
    return StateManager.getState("userOffice");
  },
  set userOffice(val) {
    StateManager.actions.setUserOffice(val);
  },

  get apiData() {
    return StateManager.getState("apiData");
  },
  set apiData(val) {
    StateManager.actions.setApiData(val);
  },

  get csrftoken() {
    return StateManager.getState("csrftoken");
  },
  set csrftoken(val) {
    StateManager.actions.setCsrfToken(val);
  },

  get recordsToday() {
    return StateManager.getState("records");
  },
  set recordsToday(val) {
    StateManager.actions.setRecords(val);
  },

  get isTextNowStatus() {
    return StateManager.getState("isTextNowStatus");
  },
  set isTextNowStatus(val) {
    StateManager.setState("isTextNowStatus", val);
  },

  get initialized() {
    return StateManager.getState("initialized");
  },
  set initialized(val) {
    StateManager.actions.setInitialized(val);
  },
};

// ==================== Queue Management for GetLink ====================
const LinkQueue = {
  processingButtons: new Set(),
  requestQueue: [],
  activeRequests: 0,
  MAX_CONCURRENT_REQUESTS: 15,

  async processQueue() {
    while (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.MAX_CONCURRENT_REQUESTS
    ) {
      const task = this.requestQueue.shift();
      if (task) {
        this.activeRequests++;
        task().finally(() => {
          this.activeRequests--;
          this.processQueue();
        });
      }
    }
  },

  addToQueue(task) {
    this.requestQueue.push(task);
    this.processQueue();
  },
};

// ==================== Global Functions (for inline onclick) ====================

/**
 * Queue getLink request
 */
function queueGetLink(event, fullInfo) {
  const button = event?.target?.closest("button");

  if (button && LinkQueue.processingButtons.has(button)) {
    console.log("Button is processing, ignoring click");
    return;
  }

  LinkQueue.addToQueue(() => getLink(event, fullInfo));
}

/**
 * Get verification link from email
 */
async function getLink(event, fullInfo) {
  const button = event?.target?.closest("button");
  const originalHTML = button?.innerHTML || "";
  const originalClass = button?.className || "";
  let email = "unknown";

  try {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const parsedInfo = Utils.parseFullInfo(fullInfo);
    if (!parsedInfo) {
      throw new Error("Invalid email data format");
    }

    email = parsedInfo.email;
    const { password_email, refresh_token, client_id } = parsedInfo;

    // Mark button as processing
    if (button) {
      LinkQueue.processingButtons.add(button);
      button.disabled = true;
      button.className = "btn btn-sm btn-secondary copy-btn";
      button.innerHTML =
        '<span class="spinner-border spinner-border-sm"></span>';
    }

    console.log(`[GetLink] Processing: ${email}`);

    const data = await ApiService.getCodeFromEmail(
      `${email}|${password_email}|${refresh_token}|${client_id}`,
    );

    const results = data.results;

    if (results?.results?.length > 0) {
      const validLinks = results.results.filter((r) => r.link && r.date);

      if (validLinks.length > 0) {
        validLinks.sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestLink = validLinks[0].link;

        // Update link element
        const linkId = "link-" + email.replace(/[^a-zA-Z0-9]/g, "-");
        const linkElement = document.getElementById(linkId);

        if (linkElement) {
          linkElement.href = latestLink;
          linkElement.style.display = "inline-block";
        }

        // Show success state
        if (button) {
          button.className = "btn btn-sm btn-success copy-btn";
          button.innerHTML = '<i class="fas fa-check"></i>';

          setTimeout(() => {
            button.className = originalClass;
            button.innerHTML = originalHTML;
            button.disabled = false;
            LinkQueue.processingButtons.delete(button);
          }, 1000);
        }

        console.log(`[GetLink] Success: ${email}`);
        return;
      }
    }

    throw new Error(results?.error || "Cannot read email at this time");
  } catch (error) {
    console.error(`[GetLink] Error (${email}):`, error);

    if (button) {
      button.className = originalClass;
      button.innerHTML = originalHTML;
      button.disabled = false;
      LinkQueue.processingButtons.delete(button);
    }
  }
}

/**
 * Edit record status (using StateManager)
 */
function editRecord(email, statusTN, statusTF) {
  // Update state via StateManager
  StateManager.actions.openEditModal(email, statusTN, statusTF);

  const modal = document.getElementById("editModal");
  const emailElement = document.getElementById("editEmail");

  if (emailElement) {
    emailElement.textContent = email;
  }

  renderEditStatusOptions();

  if (modal && typeof bootstrap !== "undefined") {
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  }
}

/**
 * Render edit status options (using StateManager)
 */
function renderEditStatusOptions() {
  const statusSelect = document.getElementById("editStatus");
  const label = document.getElementById("editStatusLabel");
  const editModal = StateManager.getState("editModal");

  if (!statusSelect || !label) return;

  statusSelect.innerHTML = "";

  const isEditingTextNow = editModal.isEditingTextNow;
  const options = isEditingTextNow
    ? [
        "not reg",
        "verified",
        "error",
        "resend link",
        "success",
        "other password",
      ]
    : ["success", "error", "resend link", "other password", "not reg"];

  label.textContent = isEditingTextNow
    ? "TextNow Status: (click to switch)"
    : "TextFree Status: (click to switch)";

  options.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
    statusSelect.appendChild(opt);
  });

  statusSelect.value = isEditingTextNow
    ? editModal.statusTN
    : editModal.statusTF;
}

/**
 * Close edit modal (using StateManager)
 */
function closeEditModal() {
  const modal = document.getElementById("editModal");
  if (modal && typeof bootstrap !== "undefined") {
    const bootstrapModal = bootstrap.Modal.getInstance(modal);
    if (bootstrapModal) {
      bootstrapModal.hide();
    }
  }
  StateManager.actions.closeEditModal();
}

/**
 * Save edit changes (using StateManager)
 */
async function saveEdit() {
  const newStatus = document.getElementById("editStatus")?.value;
  const saveButton = document.querySelector(
    "#editModal .modal-footer .btn-primary",
  );
  const editModal = StateManager.getState("editModal");

  if (!newStatus) return;

  const btnState = saveButton
    ? UIHelpers.setButtonLoading(saveButton, "Saving...")
    : null;

  try {
    const isEditingTextNow = editModal.isEditingTextNow;
    const statusField = isEditingTextNow
      ? "status_account_TN"
      : "status_account_TF";
    const data = await ApiService.updateTextNowStatus(
      editModal.email,
      statusField,
      newStatus,
    );

    if (data.success) {
      UIHelpers.showToast("Updated status successfully!", "success");

      setTimeout(() => {
        TableManager.updateRowStatus(
          editModal.email,
          newStatus,
          isEditingTextNow ? "TN" : "TF",
        );
        searchRecords();
      }, 500);
    } else {
      const errorMsg =
        "Error when updating: " + (data.error || "Unknown error");
      UIHelpers.showToast(errorMsg, "error");
    }
  } catch (error) {
    console.error("Error:", error);
    if (typeof ErrorHandler !== "undefined") {
      ErrorHandler.handleError(error, { context: "saveEdit" });
    } else {
      UIHelpers.showToast("An error occurred when updating status", "error");
    }
  } finally {
    if (btnState) btnState.restore();
    closeEditModal();
  }
}

/**
 * Toggle status label (TextNow/TextFree) - using StateManager
 */
function toggleStatusLabel() {
  const statusLabel = document.getElementById("statusLabel");
  const statusSelect = document.getElementById("statusTN");

  // Toggle via StateManager
  StateManager.actions.toggleStatusType();
  const isTextNowStatus = StateManager.getState("isTextNowStatus");

  TableManager.setStatusType(isTextNowStatus);

  if (isTextNowStatus) {
    if (statusLabel)
      statusLabel.textContent = "TextNow Status: (click to switch)";
    if (statusSelect) {
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
  } else {
    if (statusLabel)
      statusLabel.textContent = "TextFree Status: (click to switch)";
    if (statusSelect) {
      statusSelect.innerHTML = `
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="resend link">Resend link</option>
                <option value="other password">Other password</option>
                <option value="not reg">Not reg</option>
            `;
    }
  }

  if (statusSelect) statusSelect.value = "";
}

/**
 * Search records (using StateManager for filters)
 */
async function searchRecords() {
  const searchButton = document.getElementById("searchButton");
  const searchText = searchButton?.querySelector(".search-text");
  const searchLoading = searchButton?.querySelector(".search-loading");

  const selectedCreator = document.getElementById("createdBy")?.value || "";
  const selectedStatus = document.getElementById("statusTN")?.value || "";
  const selectedOffice = document.getElementById("offices")?.value || "";

  // Update filters in state
  StateManager.actions.setFilters({
    office: selectedOffice,
    status: selectedStatus,
    createdBy: selectedCreator,
  });

  // Show loading state
  StateManager.actions.setLoading(true, "Searching...");
  if (searchButton) searchButton.disabled = true;
  if (searchText) searchText.classList.add("d-none");
  if (searchLoading) searchLoading.classList.remove("d-none");

  try {
    const isTextNowStatus = StateManager.getState("isTextNowStatus");
    const params = {};
    if (selectedOffice) params.office = selectedOffice;
    if (selectedCreator) params.created_by = selectedCreator;

    if (selectedStatus) {
      if (isTextNowStatus) {
        params.status_account_TN = selectedStatus;
      } else {
        params.status_account_TF = selectedStatus;
      }
    }

    const data = await ApiService.searchTextNow(params);

    if (data.success) {
      // Update records in state
      StateManager.actions.setRecords(data.data);
      TableManager.displayRecords(data.data);

      if (data.creators) {
        TableManager.updateCreatedByDropdown(data.creators, selectedCreator);
      }

      // Restore filter values
      const statusSelect = document.getElementById("statusTN");
      if (statusSelect) statusSelect.value = selectedStatus;
    } else {
      const errorMsg = "An error occurred when searching";
      StateManager.actions.setError(errorMsg);
      UIHelpers.showToast(errorMsg, "error");
    }
  } catch (error) {
    console.error("Error:", error);
    StateManager.actions.setError(error.message);
    if (typeof ErrorHandler !== "undefined") {
      ErrorHandler.handleError(error, { context: "searchRecords" });
    } else {
      UIHelpers.showToast("An error occurred when searching", "error");
    }
  } finally {
    StateManager.actions.setLoading(false);
    if (searchButton) searchButton.disabled = false;
    if (searchText) searchText.classList.remove("d-none");
    if (searchLoading) searchLoading.classList.add("d-none");
  }
}

/**
 * Display verified records (wrapper)
 */
function displayVerifiedRecords(records) {
  TableManager.displayRecords(records);
}

/**
 * Show notification (wrapper)
 */
function showNotification(message, type = "success") {
  UIHelpers.showNotification(message, type);
}

/**
 * Show modal (wrapper)
 */
function showModal(message) {
  UIHelpers.showModal(message);
}

/**
 * Close all modals (wrapper)
 */
function closeAllModals() {
  UIHelpers.closeAllModals();
}

/**
 * Update API balances (wrapper)
 */
function updateApiBalances() {
  ApiService.updateAllBalances();
}

// ==================== Legacy Compatibility ====================
// These are kept for backward compatibility with inline handlers

window.copyTextNowInfo = ClipboardManager.copyTextNowInfo;
window.copyAllSelected = ClipboardManager.copyAllSelected;
window.queueGetLink = queueGetLink;
window.getLink = getLink;
window.editRecord = editRecord;
window.closeEditModal = closeEditModal;
window.saveEdit = saveEdit;
window.searchRecords = searchRecords;
window.displayVerifiedRecords = displayVerifiedRecords;
window.showNotification = showNotification;
window.showModal = showModal;
window.closeAllModals = closeAllModals;
window.updateApiBalances = updateApiBalances;
window.toggleStatusLabel = toggleStatusLabel;

// Mail operations
// (MailOperations removed)

// ==================== Initialization ====================

/**
 * Initialize the application (using StateManager)
 */
async function initializeApp() {
  if (StateManager.getState("initialized")) return;

  console.log(
    "[App] Initializing verified page (Phase 4: State Management)...",
  );

  try {
    // Initialize StateManager first
    StateManager.init();

    // Get CSRF token
    const csrftoken = Utils.getCSRFToken() || "";
    StateManager.actions.setCsrfToken(csrftoken);

    // Initialize API service
    ApiService.init();

    // Fetch user office
    try {
      const userOffice = await ApiService.fetchUserOffice();
      StateManager.actions.setUserOffice(userOffice);
      ApiService.setUserOffice(userOffice);
    } catch (error) {
      console.warn(
        "[App] Error fetching user office (non-critical):",
        error.message || error,
      );
    }

    // Fetch API keys
    try {
      const apiData = await ApiService.fetchApiKeys();
      StateManager.actions.setApiData(apiData);
    } catch (error) {
      console.warn(
        "[App] Error fetching API keys (non-critical):",
        error.message || error,
      );
    }

    // Update API balances
    ApiService.updateAllBalances();

    // Close any open modals
    UIHelpers.closeAllModals();

    // Setup state subscriptions for reactive updates
    setupStateSubscriptions();

    // Load initial data
    await loadInitialData();

    // Setup event listeners
    setupEventListeners();

    StateManager.actions.setInitialized(true);
    console.log("[App] Initialization complete");
    console.log("[App] State snapshot:", StateManager.getSnapshot());
  } catch (error) {
    console.error("[App] Initialization error:", error);
    StateManager.actions.setError(error.message);
  }
}

/**
 * Setup state subscriptions for reactive UI updates
 */
function setupStateSubscriptions() {
  // Subscribe to loading state changes
  StateManager.subscribe("isLoading", (isLoading) => {
    const overlay = document.querySelector(".loading-overlay");
    if (overlay) {
      overlay.style.display = isLoading ? "flex" : "none";
    }
  });

  // Subscribe to error state changes
  StateManager.subscribe("error", (error) => {
    if (error) {
      console.error("[StateManager] Error:", error);
    }
  });

  // Subscribe to isTextNowStatus for debugging
  StateManager.subscribe("isTextNowStatus", (value) => {
    console.log(
      "[StateManager] Status type changed:",
      value ? "TextNow" : "TextFree",
    );
  });
}

/**
 * Load initial data (using StateManager)
 */
async function loadInitialData() {
  try {
    const data = await ApiService.searchTextNow({
      page: 1,
      page_size: 2000,
      status_account_TN: "success,resend link",
    });

    if (data?.success && Array.isArray(data.data)) {
      StateManager.actions.setRecords(data.data);
      TableManager.displayRecords(data.data);
    } else {
      StateManager.actions.setRecords([]);
      TableManager.displayRecords([]);
    }
  } catch (error) {
    console.error("Error loading initial data:", error);
    StateManager.actions.setError(error.message);
    TableManager.displayRecords([]);
  }
}

/**
 * Load creators dropdown based on selected office
 * @param {string} office - Office name, or '' for all
 */
async function loadCreatorsByOffice(office = "") {
  try {
    const data = await ApiService.getCreatorsByOffice(office);
    if (data.success) {
      TableManager.updateCreatedByDropdown(data.creators, "");
    }
  } catch (error) {
    console.warn(
      "[App] Error loading creators by office:",
      error.message || error,
    );
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // ==================== Debounced Search ====================
  // Create debounced search function (500ms delay)
  const debouncedSearch = Utils.debounce(searchRecords, 500);

  // Auto-search when filters change
  const officesSelect = document.getElementById("offices");
  const statusTN = document.getElementById("statusTN");
  const createdBy = document.getElementById("createdBy");

  if (officesSelect) {
    officesSelect.addEventListener("change", async () => {
      await loadCreatorsByOffice(officesSelect.value);
      debouncedSearch();
    });
  }
  if (statusTN) {
    statusTN.addEventListener("change", debouncedSearch);
  }
  if (createdBy) {
    createdBy.addEventListener("change", debouncedSearch);
  }

  // Status label click
  const statusLabel = document.getElementById("statusLabel");
  if (statusLabel) {
    statusLabel.addEventListener("click", toggleStatusLabel);
  }

  // Edit modal label click (using StateManager)
  const editStatusLabel = document.getElementById("editStatusLabel");
  if (editStatusLabel) {
    editStatusLabel.addEventListener("click", () => {
      StateManager.actions.toggleEditStatusType();
      renderEditStatusOptions();
    });
  }

  // Window click to close edit modal
  window.addEventListener("click", (event) => {
    const modal = document.getElementById("editModal");
    if (event.target === modal) {
      closeEditModal();
    }
  });
}

// ==================== DOM Ready ====================
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// ==================== Expose for debugging ====================
window.AppState = AppState;
window.LinkQueue = LinkQueue;
window.StateManager = StateManager; // Expose StateManager for debugging
