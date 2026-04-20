/**
 * API Service Module
 * Centralized API calls with consistent error handling and async/await
 * Phase 3: Added request caching for performance optimization
 * Phase 5: Enhanced error handling with ErrorHandler integration
 * @module ApiService
 */

"use strict";

const ApiService = (function () {
  // Configuration
  const DEFAULT_TIMEOUT = 30000; // 30 seconds
  const LONG_TIMEOUT = 90000; // 90 seconds for email reading
  const MAX_RETRIES = 3; // For retryable errors

  // Cache Configuration
  const CACHE_TTL = {
    userOffice: 5 * 60 * 1000, // 5 minutes
    apiKeys: 10 * 60 * 1000, // 10 minutes
    balance: 30 * 1000, // 30 seconds
    reserveMailCount: 60 * 1000, // 1 minute
    search: 10 * 1000, // 10 seconds
  };

  // Request Cache
  const cache = new Map();
  const pendingRequests = new Map(); // Deduplicate in-flight requests

  // State
  let apiData = {
    api_dongvan: "",
    api_fmail: "",
    api_phapsu: "",
  };
  let userOffice = "";
  let csrftoken = "";

  /**
   * Get cached data if valid
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in milliseconds
   * @returns {*} Cached data or null
   */
  function getCached(key, ttl) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache data
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   */
  function setCache(key, data) {
    cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear specific cache entry or all cache
   * @param {string} key - Cache key (optional, clears all if not provided)
   */
  function clearCache(key) {
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }

  /**
   * Deduplicate concurrent requests to same endpoint
   * @param {string} key - Request key
   * @param {Function} requestFn - Request function
   * @returns {Promise} Request promise
   */
  async function deduplicateRequest(key, requestFn) {
    // If same request is already in-flight, return existing promise
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    // Create new request
    const promise = requestFn().finally(() => {
      pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Initialize API service
   */
  function init() {
    csrftoken = Utils.getCSRFToken() || "";
  }

  /**
   * Set API keys
   * @param {Object} data - API keys object
   */
  function setApiData(data) {
    if (data) {
      apiData = { ...apiData, ...data };
    }
  }

  /**
   * Get API data
   * @returns {Object} API keys
   */
  function getApiData() {
    return { ...apiData };
  }

  /**
   * Set user office
   * @param {string} office - Office name
   */
  function setUserOffice(office) {
    userOffice = office || "";
  }

  /**
   * Get user office
   * @returns {string} Office name
   */
  function getUserOffice() {
    return userOffice;
  }

  /**
   * Create fetch request with timeout and error handling
   * Phase 5: Enhanced error handling with ErrorHandler integration
   * @param {string} url - Request URL
   * @param {Object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>} Fetch response
   */
  async function fetchWithTimeout(
    url,
    options = {},
    timeout = DEFAULT_TIMEOUT,
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // Use ErrorHandler for proper error categorization
      if (typeof ErrorHandler !== "undefined") {
        throw ErrorHandler.fromNetworkError(error);
      }
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout / 1000} seconds`);
      }
      throw error;
    }
  }

  /**
   * Handle HTTP response errors consistently
   * @param {Response} response - Fetch response
   * @returns {Promise<void>}
   */
  async function handleResponseError(response) {
    if (response.ok) return;

    let responseData = null;
    try {
      responseData = await response.text();
      // Try to parse as JSON for more details
      try {
        responseData = JSON.parse(responseData);
      } catch {}
    } catch {}

    if (typeof ErrorHandler !== "undefined") {
      throw ErrorHandler.fromHttpResponse(response, responseData);
    }

    throw new Error(
      `HTTP error! status: ${response.status}. ${String(responseData || "").slice(0, 200)}`,
    );
  }

  /**
   * Make GET request
   * @param {string} url - Request URL
   * @param {Object} params - Query parameters
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} JSON response
   */
  async function get(url, params = {}, timeout = DEFAULT_TIMEOUT) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;

    const response = await fetchWithTimeout(
      fullUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
      timeout,
    );

    await handleResponseError(response);

    try {
      return await response.json();
    } catch (error) {
      if (typeof ErrorHandler !== "undefined") {
        throw ErrorHandler.fromParseError(error);
      }
      throw error;
    }
  }

  /**
   * Make POST request with JSON body
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} JSON response
   */
  async function post(url, data = {}, timeout = DEFAULT_TIMEOUT) {
    const token =
      typeof Security !== "undefined"
        ? Security.getCSRFToken()
        : csrftoken || Utils.getCSRFToken();

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": token,
        },
        body: JSON.stringify(data),
      },
      timeout,
    );

    await handleResponseError(response);

    try {
      return await response.json();
    } catch (error) {
      if (typeof ErrorHandler !== "undefined") {
        throw ErrorHandler.fromParseError(error);
      }
      throw error;
    }
  }

  /**
   * Make POST request with FormData
   * @param {string} url - Request URL
   * @param {FormData|Object} data - Form data
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} JSON response
   */
  async function postForm(url, data, timeout = DEFAULT_TIMEOUT) {
    let formData;
    if (data instanceof FormData) {
      formData = data;
    } else {
      formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const token =
      typeof Security !== "undefined"
        ? Security.getCSRFToken()
        : csrftoken || Utils.getCSRFToken();

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "X-CSRFToken": token,
        },
        body: formData,
      },
      timeout,
    );

    await handleResponseError(response);

    try {
      return await response.json();
    } catch (error) {
      if (typeof ErrorHandler !== "undefined") {
        throw ErrorHandler.fromParseError(error);
      }
      throw error;
    }
  }

  /**
   * Make POST request with URL-encoded body
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} JSON response
   */
  async function postUrlEncoded(url, data = {}, timeout = DEFAULT_TIMEOUT) {
    const body = Object.entries(data)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");

    const token =
      typeof Security !== "undefined"
        ? Security.getCSRFToken()
        : csrftoken || Utils.getCSRFToken();

    const response = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRFToken": token,
        },
        body,
      },
      timeout,
    );

    await handleResponseError(response);

    try {
      return await response.json();
    } catch (error) {
      if (typeof ErrorHandler !== "undefined") {
        throw ErrorHandler.fromParseError(error);
      }
      throw error;
    }
  }

  /**
   * Make request with automatic retry for retryable errors
   * @param {Function} requestFn - Request function to retry
   * @param {Object} options - Retry options
   * @returns {Promise<*>} Response
   */
  async function withRetry(requestFn, options = {}) {
    if (typeof ErrorHandler !== "undefined" && ErrorHandler.withRetry) {
      return ErrorHandler.withRetry(requestFn, {
        maxRetries: options.maxRetries || MAX_RETRIES,
        ...options,
      });
    }
    // Fallback: just execute without retry
    return requestFn();
  }

  // ==================== Specific API Methods ====================

  /**
   * Fetch user office from server (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<string>} User office
   */
  async function fetchUserOffice(forceRefresh = false) {
    const cacheKey = "userOffice";

    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.userOffice);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        const data = await get("/api/get-user-office/");
        if (data.success && data.office) {
          userOffice = data.office;
          setCache(cacheKey, data.office);
          return data.office;
        }
        // Return empty string instead of throwing for optional data
        console.warn("User office not available:", data.error || "No data");
        return "";
      } catch (error) {
        // Gracefully handle 404 or other errors for optional endpoint
        console.warn(
          "Error getting user office (non-critical):",
          error.message || error,
        );
        return "";
      }
    });
  }

  /**
   * Fetch API keys from server (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} API keys
   */
  async function fetchApiKeys(forceRefresh = false) {
    const cacheKey = "apiKeys";

    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.apiKeys);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        const data = await get("/api/get-api-data/");
        if (data && data.success) {
          apiData = {
            api_dongvan: data.api_dongvan || "",
            api_fmail: data.api_fmail || "",
            api_phapsu: data.api_phapsu || "",
          };
          setCache(cacheKey, apiData);
          return apiData;
        }
        // Return default empty values instead of throwing
        console.warn("API keys not available:", data?.error || "No data");
        return { api_dongvan: "", api_fmail: "", api_phapsu: "" };
      } catch (error) {
        // Gracefully handle 404 or other errors for optional endpoint
        console.warn(
          "Error getting API keys (non-critical):",
          error.message || error,
        );
        return { api_dongvan: "", api_fmail: "", api_phapsu: "" };
      }
    });
  }

  /**
   * Search TextNow records (with caching for identical searches)
   * @param {Object} params - Search parameters
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Search results
   */
  async function searchTextNow(params = {}, forceRefresh = false) {
    const searchParams = new URLSearchParams();

    if (params.status_account_TN)
      searchParams.append("status_account_TN", params.status_account_TN);
    if (params.status_account_TF)
      searchParams.append("status_account_TF", params.status_account_TF);
    if (params.page) searchParams.append("page", params.page);
    if (params.page_size) searchParams.append("page_size", params.page_size);
    // employee: partial text search on created_by field
    if (params.employee) searchParams.append("employee", params.employee);
    // Note: date and office are intentionally NOT sent — server always uses today + all offices

    const queryString = searchParams.toString();
    const cacheKey = `search:${queryString}`;

    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.search);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      const data = await get(`/api/search-textnow/?${queryString}`);
      setCache(cacheKey, data);
      return data;
    });
  }

  /**
   * Suggest employee usernames matching a partial query
   * @param {string} query - Partial username to search
   * @returns {Promise<Object>} {success, suggestions[]}
   */
  async function suggestEmployees(query) {
    return get("/api/suggest-employees/", { q: query });
  }

  /**
   * Update TextNow status (clears search cache)
   * @param {string} email - Email address
   * @param {string} field - Status field (status_account_TN or status_account_TF)
   * @param {string} status - New status
   * @returns {Promise<Object>} Update result
   */
  async function updateTextNowStatus(email, field, status) {
    // Clear search cache on update
    for (const key of cache.keys()) {
      if (key.startsWith("search:")) {
        cache.delete(key);
      }
    }

    return post("/api/verified-textnow-update/", {
      email,
      [field]: status,
    });
  }

  /**
   * Check employee password record
   * @returns {Promise<Object>} Check result
   */
  async function checkEmployeePassword() {
    return get("/api/check-employee-password-today/");
  }

  /**
   * Get employee passwords
   * @returns {Promise<Object>} Password data
   */
  async function getEmployeePasswords() {
    return get("/api/get-employee-passwords/");
  }

  /**
   * Get reserve mail count (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Count data
   */
  async function getReserveMailCount(forceRefresh = false) {
    const cacheKey = "reserveMailCount";
    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.reserveMailCount);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      try {
        const data = await get("/api/get-reserve-mail-count/");
        if (data && data.success) {
          setCache(cacheKey, data);
          return data;
        }
        // Return default value if API fails
        console.warn(
          "Reserve mail count not available:",
          data?.error || "No data",
        );
        return { success: false, count: 0 };
      } catch (error) {
        // Gracefully handle errors for this optional endpoint
        console.warn(
          "Error getting reserve mail count (non-critical):",
          error.message || error,
        );
        return { success: false, count: 0 };
      }
    });
  }

  /**
   * Get reserve mails (clears cache after success)
   * @param {number} quantity - Number of mails to get
   * @returns {Promise<Object>} Result
   */
  async function getReserveMails(quantity) {
    const result = await post("/api/get-reserve-mails/", {
      office: userOffice,
      quantity,
    });
    // Clear cache since count changed
    clearCache("reserveMailCount");
    return result;
  }

  /**
   * Save purchased emails
   * @param {Array} emails - Email data array
   * @param {string} importType - Import type
   * @returns {Promise<Object>} Save result
   */
  async function savePurchasedEmails(emails, importType = "buymail") {
    return post("/api/save-purchased-emails/", {
      emails,
      office: userOffice,
      import_type: importType,
    });
  }

  /**
   * Save iCloud accounts
   * @param {Array} accounts - Account data array
   * @returns {Promise<Object>} Save result
   */
  async function saveICloudAccounts(accounts) {
    return post("/api/save-icloud-accounts/", {
      accounts,
      office: userOffice,
    });
  }

  /**
   * Save Gmail Recovery accounts
   * @param {Array} accounts - Account data array
   * @returns {Promise<Object>} Save result
   */
  async function saveGmailRecoveryAccounts(accounts) {
    return post("/api/save-gmail-recovery-accounts/", {
      accounts,
      office: userOffice,
    });
  }

  /**
   * Delete all employee emails
   * @returns {Promise<Object>} Delete result
   */
  async function deleteAllEmployeeEmails() {
    return post("/api/delete-all-employee-emails/", {});
  }

  /**
   * Get verification code from email
   * @param {string} emailData - Email data string
   * @returns {Promise<Object>} Result with link
   */
  async function getCodeFromEmail(emailData) {
    const formData = new FormData();
    formData.append("email_data", emailData);

    return postForm("/api/get-code-tn/", formData, LONG_TIMEOUT);
  }

  // ==================== External API Methods ====================

  /**
   * Get DongVan balance (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Balance data
   */
  async function getDongVanBalance(forceRefresh = false) {
    if (!apiData.api_dongvan) {
      throw new Error("DongVan API key not configured");
    }

    const cacheKey = "balance:dongvan";
    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.balance);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      const data = await get("/api/dongvan-balance/", {
        apikey: apiData.api_dongvan,
      });
      setCache(cacheKey, data);
      return data;
    });
  }

  /**
   * Get fMail balance (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Balance data
   */
  async function getFMailBalance(forceRefresh = false) {
    if (!apiData.api_fmail) {
      throw new Error("fMail API key not configured");
    }

    const cacheKey = "balance:fmail";
    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.balance);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      const data = await get("/api/fmail-balance/", {
        apikey: apiData.api_fmail,
      });
      setCache(cacheKey, data);
      return data;
    });
  }

  /**
   * Get PhapSu balance (with caching)
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Object>} Balance data
   */
  async function getPhapSuBalance(forceRefresh = false) {
    if (!apiData.api_phapsu) {
      throw new Error("PhapSu API key not configured");
    }

    const cacheKey = "balance:phapsu";
    if (!forceRefresh) {
      const cached = getCached(cacheKey, CACHE_TTL.balance);
      if (cached) return cached;
    }

    return deduplicateRequest(cacheKey, async () => {
      const data = await get("/api/phapsu-balance/", {
        apikey: apiData.api_phapsu,
      });
      setCache(cacheKey, data);
      return data;
    });
  }

  /**
   * Get DongVan mail list
   * @returns {Promise<Object>} Mail list
   */
  async function getDongVanMailList() {
    if (!apiData.api_dongvan) {
      throw new Error("DongVan API key not configured");
    }
    const response = await fetch(
      `https://api.dongvanfb.net/user/account_type?apikey=${apiData.api_dongvan}`,
    );
    return response.json();
  }

  /**
   * Buy mail from DongVan
   * @param {number} accountType - Account type ID
   * @param {number} quantity - Quantity to buy
   * @returns {Promise<Object>} Purchase result
   */
  async function buyDongVanMail(accountType, quantity) {
    if (!apiData.api_dongvan) {
      throw new Error("DongVan API key not configured");
    }
    const response = await fetch(
      `https://api.dongvanfb.net/user/buy?apikey=${apiData.api_dongvan}&account_type=${accountType}&quality=${quantity}&type=full`,
    );
    return response.json();
  }

  /**
   * Get fMail mail list
   * @returns {Promise<Object>} Mail list
   */
  async function getFMailList() {
    if (!apiData.api_fmail) {
      throw new Error("fMail API key not configured");
    }
    return get("/api/fmail-list/", { apikey: apiData.api_fmail });
  }

  /**
   * Buy mail from fMail
   * @param {number} id - Mail type ID
   * @param {number} amount - Amount to buy
   * @returns {Promise<Object>} Purchase result
   */
  async function buyFMail(id, amount) {
    if (!apiData.api_fmail) {
      throw new Error("fMail API key not configured");
    }
    return postUrlEncoded(`/api/fmail-buy/?apikey=${apiData.api_fmail}`, {
      id,
      amount,
    });
  }

  /**
   * Get PhapSu mail list
   * @returns {Promise<Object>} Mail list
   */
  async function getPhapSuList() {
    if (!apiData.api_phapsu) {
      throw new Error("PhapSu API key not configured");
    }
    return get("/api/phapsu-list/", { apikey: apiData.api_phapsu });
  }

  /**
   * Buy mail from PhapSu
   * @param {number} id - Mail type ID
   * @param {number} amount - Amount to buy
   * @returns {Promise<Object>} Purchase result
   */
  async function buyPhapSu(id, amount) {
    if (!apiData.api_phapsu) {
      throw new Error("PhapSu API key not configured");
    }
    return postUrlEncoded(`/api/phapsu-buy/?apikey=${apiData.api_phapsu}`, {
      id,
      amount,
    });
  }

  /**
   * Update all API balances in UI
   */
  async function updateAllBalances() {
    const dongvanBadge = document.getElementById("dongvanBalance");
    const fmailBadge = document.getElementById("fmailBalance");
    const phapsuBadge = document.getElementById("phapsuBalance");

    const updateBadge = (badge, promise) => {
      if (!badge) return;
      promise
        .then((data) => {
          if (data.success && data.data?.money !== undefined) {
            badge.textContent =
              data.data.money.toLocaleString("vi-VN") + " VND";
          } else {
            badge.textContent = "?";
          }
        })
        .catch(() => {
          badge.textContent = "?";
        });
    };

    if (apiData.api_dongvan) {
      updateBadge(dongvanBadge, getDongVanBalance());
    }
    if (apiData.api_fmail) {
      updateBadge(fmailBadge, getFMailBalance());
    }
    if (apiData.api_phapsu) {
      updateBadge(phapsuBadge, getPhapSuBalance());
    }
  }

  // Initialize on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  return {
    // Configuration
    init,
    setApiData,
    getApiData,
    setUserOffice,
    getUserOffice,

    // Generic methods
    get,
    post,
    postForm,
    postUrlEncoded,
    fetchWithTimeout,
    withRetry,

    // Cache management
    clearCache,
    getCached,
    setCache,

    // Specific API methods
    fetchUserOffice,
    fetchApiKeys,
    searchTextNow,
    suggestEmployees,
    updateTextNowStatus,
    checkEmployeePassword,
    getEmployeePasswords,
    getReserveMailCount,
    getReserveMails,
    savePurchasedEmails,
    saveICloudAccounts,
    saveGmailRecoveryAccounts,
    deleteAllEmployeeEmails,
    getCodeFromEmail,

    // External APIs
    getDongVanBalance,
    getFMailBalance,
    getPhapSuBalance,
    getDongVanMailList,
    buyDongVanMail,
    getFMailList,
    buyFMail,
    getPhapSuList,
    buyPhapSu,
    updateAllBalances,
  };
})();

// Export for module usage and global access
if (typeof module !== "undefined" && module.exports) {
  module.exports = ApiService;
}
window.ApiService = ApiService;
