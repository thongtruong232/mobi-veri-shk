// Utilities: escape helpers to prevent XSS in HTML and attributes
function escapeHtml(str) {
  try {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  } catch (_) {
    return "";
  }
}
function escapeAttr(str) {
  // For attribute values in HTML; reuse HTML escaping
  return escapeHtml(str);
}

// Hàm format date thành DD/MM/YYYY (dùng chung cho tất cả xử lý date)
function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return null;

  // Nếu là string, thử parse
  let dateObj;
  if (typeof dateInput === "string") {
    // Thử parse các format phổ biến
    // Format DD-MM-YYYY hoặc D-M-YYYY
    const dmyMatch = dateInput.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
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
      // Format d/m/yyyy hoặc d/m/yy
      const dmySlashMatch = dateInput.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
      );
      if (dmySlashMatch) {
        const day = parseInt(dmySlashMatch[1], 10);
        const month = parseInt(dmySlashMatch[2], 10);
        let year = parseInt(dmySlashMatch[3], 10);
        if (year < 100) {
          year = year < 50 ? 2000 + year : 1900 + year;
        }
        dateObj = new Date(year, month - 1, day);
      } else {
        // Thử parse ISO format hoặc các format khác
        dateObj = new Date(dateInput);
      }
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
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

// Namespaced localStorage per user (and office)
(function () {
  try {
    const currentUser = window.userData ? window.userData.username : "";
    const currentOffice = window.userData ? window.userData.office : "";
    const LS_PREFIX = `app:user:${currentUser}${
      currentOffice ? `:office:${currentOffice}` : ""
    }:`;

    const _get = localStorage.getItem.bind(localStorage);
    const _set = localStorage.setItem.bind(localStorage);
    const _remove = localStorage.removeItem.bind(localStorage);

    function ns(key) {
      return LS_PREFIX + key;
    }

    localStorage.getItem = function (key) {
      return _get(ns(key));
    };
    localStorage.setItem = function (key, value) {
      return _set(ns(key), value);
    };
    localStorage.removeItem = function (key) {
      return _remove(ns(key));
    };

    window.cleanupUserLocalStorageNamespace = function () {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LS_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => _remove(k));
    };
  } catch (e) {
    console.warn("localStorage namespacing init error", e);
  }
})();

// Hàm kiểm tra tính hợp lệ của password và cập nhật trạng thái button
function updateFetchButtonState() {
  const fetchEmailsBtn = document.getElementById("fetchEmailsBtn");
  if (!fetchEmailsBtn) return;

  const passTnFromDom = (
    document.getElementById("passTnInfo")?.textContent || ""
  )
    .replace(/^TN password:\s*/i, "")
    .trim();

  const isValidPassword =
    passTnFromDom &&
    passTnFromDom !== "[No data]" &&
    passTnFromDom !== "[Error]" &&
    passTnFromDom.length > 0;

  if (isValidPassword) {
    fetchEmailsBtn.disabled = false;
    fetchEmailsBtn.style.opacity = "1";
    fetchEmailsBtn.style.cursor = "pointer";
    fetchEmailsBtn.title = "Click to fetch emails";
  } else {
    fetchEmailsBtn.disabled = true;
    fetchEmailsBtn.style.opacity = "0.6";
    fetchEmailsBtn.style.cursor = "not-allowed";
    fetchEmailsBtn.title =
      "No valid TextNow password available. Please add a password first.";
  }
}

// Hàm global để refresh trạng thái button (có thể gọi từ bên ngoài)
window.refreshFetchButtonState = function () {
  updateFetchButtonState();
};

async function getEmployeePasswords() {
  // Lấy mật khẩu Tn và TF và hiển thị lên cạnh tiêu đề
  fetch("/api/get-employee-passwords/")
    .then((res) => res.json())
    .then((data) => {
      // console.log('data:',data)
      if (data.success) {
        document.getElementById("passTnInfo").textContent =
          "TN password: " + (data.pass_TN || "[No data]");
        document.getElementById("passTfInfo").textContent =
          "TF password: " + (data.pass_TF || "[No data]");
      } else {
        document.getElementById("passTnInfo").textContent =
          "TN password: [No data]";
        document.getElementById("passTfInfo").textContent =
          "TF password: [No data]";
      }
      // Cập nhật trạng thái button sau khi có thông tin password
      updateFetchButtonState();
      // Sau khi có base password, render bảng để áp dụng hậu tố ngay
      try {
        displayEmailsFromStorage();
      } catch (_) {}
    })
    .catch(() => {
      document.getElementById("passTnInfo").textContent =
        "TN password: [Error]";
      document.getElementById("passTfInfo").textContent =
        "TF password: [Error]";
      // Cập nhật trạng thái button khi có lỗi
      updateFetchButtonState();
    });
}

// Lấy office của user hiện tại
let userOffice = "";
// Main QR widget (left)
let qrCodesMain = [];
let currentIndexMain = 0;
// VN QR widget (right)
let qrCodesVn = [];
let currentIndexVn = 0;

async function getUserOffice() {
  try {
    const userResponse = await fetch("/api/get-current-user/");
    const userData = await userResponse.json();
    if (userData.success) {
      userOffice = userData.office;
      setupQRCodes();
      setDefaultQRCode();
    }
  } catch (error) {
    console.error("Error getting user office:", error);
  }
}

// Hàm set QR code mặc định dựa trên office
function setDefaultQRCode() {
  const qrCodeImage = document.getElementById("qrCodeImage");
  const qrCodeName = document.getElementById("qrCodeName");
  const qrCodeSelect = document.getElementById("qrCodeSelect");
  const qrCodeImageVn = document.getElementById("qrCodeImageVn");
  const qrCodeNameVn = document.getElementById("qrCodeNameVn");
  const qrCodeSelectVn = document.getElementById("qrCodeSelectVn");
  if (qrCodesMain.length > 0) {
    currentIndexMain = Math.floor(Math.random() * qrCodesMain.length);
    if (qrCodeImage) qrCodeImage.src = qrCodesMain[currentIndexMain].src;
    if (qrCodeName) qrCodeName.textContent = qrCodesMain[currentIndexMain].name;
    if (qrCodeSelect && qrCodeSelect.options.length === qrCodesMain.length) {
      qrCodeSelect.selectedIndex = currentIndexMain;
    }
  }
  if (qrCodesVn.length > 0) {
    currentIndexVn = Math.floor(Math.random() * qrCodesVn.length);
    if (qrCodeImageVn) qrCodeImageVn.src = qrCodesVn[currentIndexVn].src;
    if (qrCodeNameVn) qrCodeNameVn.textContent = qrCodesVn[currentIndexVn].name;
    if (qrCodeSelectVn && qrCodeSelectVn.options.length === qrCodesVn.length) {
      qrCodeSelectVn.selectedIndex = currentIndexVn;
    }
  }
}

// Hàm setup QR codes dựa trên office
function setupQRCodes() {
  // Get STATIC_URL from window (set in HTML template)
  const staticUrl = window.STATIC_URL || "/static/";

  // Bạn có thể thay bộ ảnh VN riêng tại đây (qrCodesVn)
  if (userOffice === "Hàn Mạc Tử") {
    qrCodesMain = [
      { src: staticUrl + "images/HMT-VN-US-1.jpg", name: "US-1" },
      { src: staticUrl + "images/HMT-VN-US-2.jpg", name: "US-2" },
      { src: staticUrl + "images/HMT-VN-US-3.jpg", name: "US-3" },
      { src: staticUrl + "images/HMT-VN-US-NEW1.jpg", name: "US-NEW1" },
    ];
    qrCodesVn = [
      { src: staticUrl + "images/HMT-VN-APP.jpg", name: "APP" },
      { src: staticUrl + "images/HMT-VN-ACTIVE-1.jpg", name: "ACTIVE-1" },
      { src: staticUrl + "images/HMT-VN-ACTIVE-2.jpg", name: "ACTIVE-2" },
      { src: staticUrl + "images/HMT-VN-ACTIVE-3.jpg", name: "ACTIVE-3" },
      { src: staticUrl + "images/HMT-VN-MI-1.jpg", name: "MI-1" },
      { src: staticUrl + "images/HMT-VN-MI-2.jpg", name: "MI-2" },
      { src: staticUrl + "images/HMT-VN-VT-3.jpg", name: "VT-3" },
    ];
  }
  currentIndexMain = 0;
  currentIndexVn = 0;
  renderQrSelectOptions();
}

// Render options cho dropdown QR và đồng bộ với currentIndex
function renderQrSelectOptions() {
  const qrCodeSelect = document.getElementById("qrCodeSelect");
  const qrCodeSelectVn = document.getElementById("qrCodeSelectVn");
  if (qrCodeSelect) {
    qrCodeSelect.innerHTML = "";
    qrCodesMain.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = item.name;
      qrCodeSelect.appendChild(opt);
    });
    if (qrCodesMain.length > 0) qrCodeSelect.selectedIndex = currentIndexMain;
  }
  if (qrCodeSelectVn) {
    qrCodeSelectVn.innerHTML = "";
    qrCodesVn.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = item.name;
      qrCodeSelectVn.appendChild(opt);
    });
    if (qrCodesVn.length > 0) qrCodeSelectVn.selectedIndex = currentIndexVn;
  }
}

// Biến toàn cục
let currentSelect = null;
let currentTableType = "normal"; // 'normal' | 'gmail_recovery'
let gmailRecoveryEmails = [];
// Bulk change state: bảng nào và cột nào (tn|tf) đang được chọn
let currentBulkStatusTableType = "normal";
let currentBulkStatusField = "tn";
// Hàm để hiển thị/ẩn nút Reg Acc
function toggleRegAccButton() {
  const regAccBtn = document.getElementById("regAccBtn");
  const checkedBoxes = document.querySelectorAll(".email-checkbox:checked");
  regAccBtn.style.display = checkedBoxes.length > 0 ? "block" : "none";
}

function toggleRegAccButtonGR() {
  const regAccBtn = document.getElementById("regAccBtnGR");
  const checkedBoxes = document.querySelectorAll(".email-checkbox-gr:checked");
  regAccBtn.style.display = checkedBoxes.length > 0 ? "block" : "none";
}

// Hàm để hiển thị dữ liệu email
function displayEmails(emails) {
  // Lấy TN password mặc định từ DOM (nếu có)
  const passTnFromDom = (
    document.getElementById("passTnInfo")?.textContent || ""
  )
    .replace(/^TN password:\s*/i, "")
    .trim();
  const today = new Date();
  const formattedDate = formatDateDDMMYYYY(today); // DD/MM/YYYY

  // Lọc chỉ lấy email có date đúng ngày hôm nay và loại bỏ trùng lặp theo email
  const filteredEmails = [];
  const emailSet = new Set();
  // Chuẩn bị cập nhật localStorage nếu cần
  let needSavePassFix = false;
  let storedSession = [];
  try {
    storedSession = JSON.parse(
      localStorage.getItem("employee_worksession") || "[]",
    );
  } catch (_) {
    storedSession = [];
  }
  const emailToIndex = new Map(storedSession.map((e, i) => [e.email, i]));

  emails.forEach((email) => {
    // Chuyển đổi date sang định dạng DD/MM/YYYY
    let emailDate = "";
    const rawDate = email.date || email.date_get || "";
    if (rawDate) {
      const parsedDate = formatDateDDMMYYYY(rawDate);
      if (parsedDate) {
        emailDate = parsedDate;
      }
    }
    if (emailDate === formattedDate && !emailSet.has(email.email)) {
      filteredEmails.push({ ...email, timestamp: Date.now() });
      emailSet.add(email.email);
    }
  });

  const emailsTableBody = document.getElementById("emailsTableBody");
  emailsTableBody.innerHTML = "";

  // Logging khi không có dữ liệu để hiển thị
  if (!filteredEmails || filteredEmails.length === 0) {
    // Chỉ log khi thực sự không có dữ liệu (không phải do lọc)
    const hasNoData = !emails || emails.length === 0;
    const hasDataButFiltered = emails && emails.length > 0;

    if (hasNoData) {
      // Trường hợp: Không có dữ liệu từ nguồn
      const logData = {
        error: "No available email - No data source",
        timestamp: new Date().toISOString(),
        details: {
          emailsInput: emails,
          emailsLength: emails ? emails.length : 0,
          filteredLength: filteredEmails ? filteredEmails.length : 0,
          todayDate: formattedDate,
          localStorage: {
            hasData: !!localStorage.getItem("employee_worksession"),
            dataLength: storedSession ? storedSession.length : 0,
          },
        },
      };
      console.error("[EMAIL_TABLE_ERROR]", logData);
    } else if (hasDataButFiltered) {
      // Trường hợp: Có dữ liệu nhưng bị lọc hết (date không khớp)
      const emailsWithDate = emails.filter((e) => {
        const rawDate = e.date_get || e.date || "";
        return !!rawDate;
      });
      const emailsWithoutDate = emails.filter((e) => {
        const rawDate = e.date_get || e.date || "";
        return !rawDate;
      });
      const emailsWithTodayDate = emails.filter((e) => {
        const rawDate = e.date_get || e.date || "";
        if (!rawDate) return false;
        const parsedDate = formatDateDDMMYYYY(rawDate);
        return parsedDate === formattedDate;
      });

      const logData = {
        error: "No available email - All emails filtered out",
        timestamp: new Date().toISOString(),
        details: {
          totalEmails: emails.length,
          todayDate: formattedDate,
          emailsWithDate: emailsWithDate.length,
          emailsWithoutDate: emailsWithoutDate.length,
          emailsWithTodayDate: emailsWithTodayDate.length,
          sampleDates: emails.slice(0, 5).map((e) => ({
            email: e.email,
            date: e.date,
            date_get: e.date_get,
            parsed: formatDateDDMMYYYY(e.date_get || e.date || ""),
          })),
        },
      };
      console.warn("[EMAIL_TABLE_WARNING]", logData);
    }
  }

  if (filteredEmails && filteredEmails.length > 0) {
    const frag = document.createDocumentFragment();
    filteredEmails.forEach((email, index) => {
      const row = document.createElement("tr");
      row.className = "email-row";
      row.setAttribute("data-email", email.email); // Thêm data-email để tìm dòng
      if (email.is_reg_acc) {
        row.classList.add("row-disabled");
      }

      // Kiểm tra trạng thái TN, TF (TT status disabled for now)
      const showTNX = email.status_account_TN === "new";
      const showTFX = email.status_account_TF === "new";

      // Chỉ hiển thị checkbox khi TN và TF khác "new"
      const showCheckbox = !showTNX && !showTFX;

      // Danh sách option mặc định
      const defaultOptions = [
        { value: "new", text: "New" },
        { value: "verified", text: "Verified" },
        { value: "success", text: "Success" },
        { value: "error", text: "Error" },
        { value: "other password", text: "Other password" },
        { value: "not reg", text: "Not reg" },
        { value: "resend link", text: "Resend link" },
      ];
      // Xử lý option cho TN
      let tnOptionsHtml = "";
      defaultOptions.forEach((opt) => {
        if (
          opt.value === "other password" &&
          email.status_account_TN === "other password"
        ) {
          tnOptionsHtml += `<option value="other password" selected>${
            email.pass_TN || ""
          }</option>`;
        } else {
          tnOptionsHtml += `<option value="${opt.value}"${
            email.status_account_TN === opt.value ? " selected" : ""
          }>${opt.text}</option>`;
        }
      });
      // Xử lý option cho TF (ẩn 'Verified' đối với TF)
      const tfOptions = defaultOptions.filter(
        (opt) => opt.value !== "verified",
      );
      let tfOptionsHtml = "";
      tfOptions.forEach((opt) => {
        if (
          opt.value === "other password" &&
          email.status_account_TF === "other password"
        ) {
          tfOptionsHtml += `<option value="other password" selected>${
            email.pass_TF || ""
          }</option>`;
        } else {
          tfOptionsHtml += `<option value="${opt.value}"${
            email.status_account_TF === opt.value ? " selected" : ""
          }>${opt.text}</option>`;
        }
      });

      // Lấy code đã lưu từ localStorage
      const storedCodes = JSON.parse(
        localStorage.getItem("mail_codes") || "{}",
      );
      const tnCodeRaw = storedCodes[email.email]?.tn || "";
      const tfCodeRaw = storedCodes[email.email]?.tf || "";
      const tnCode =
        tnCodeRaw && typeof tnCodeRaw === "object"
          ? tnCodeRaw.code || ""
          : typeof tnCodeRaw === "string"
            ? tnCodeRaw
            : "";
      const tfCode =
        tfCodeRaw && typeof tfCodeRaw === "object"
          ? tfCodeRaw.code || ""
          : typeof tfCodeRaw === "string"
            ? tfCodeRaw
            : "";

      // Tính mật khẩu hiển thị: luôn theo "passTnInfo" + No(3) + '@'
      const rowNo = String(index + 1).padStart(3, "0");
      const baseFromUi = passTnFromDom || "";

      // Validate base password trước khi tạo mật khẩu
      const isValidBasePassword =
        baseFromUi &&
        baseFromUi !== "[No data]" &&
        baseFromUi !== "[Error]" &&
        baseFromUi.length > 0;

      // Kiểm tra nếu có password custom (không match pattern base + No + '@')
      const defaultFormat = /^.+\d{3}@$/;
      const isCustomPassword =
        email.pass_TN &&
        email.pass_TN !== baseFromUi &&
        !defaultFormat.test(email.pass_TN);

      // Chỉ tính lại displayPassTn nếu KHÔNG có password custom
      let displayPassTn = "";
      if (isCustomPassword) {
        // Nếu đã có password custom, dùng password đó
        displayPassTn = email.pass_TN;
      } else if (isValidBasePassword) {
        // Tính theo format base + No nếu chưa có password custom
        displayPassTn = baseFromUi + rowNo + "@";
      }

      // Ghi ngược vào localStorage để đồng bộ dữ liệu hiển thị (chỉ nếu KHÔNG có password custom)
      if (displayPassTn && !isCustomPassword) {
        email.pass_TN = displayPassTn;
        const idx = emailToIndex.has(email.email)
          ? emailToIndex.get(email.email)
          : -1;
        if (idx !== -1) {
          storedSession[idx].pass_TN = displayPassTn;
          needSavePassFix = true;
        }
      }

      // Safe values for HTML and attribute contexts
      const safeEmail = escapeHtml(email.email);
      const safeEmailAttr = escapeAttr(email.email);
      const safePasswordEmailAttr = escapeAttr(email.password_email || "");
      const safeRefreshTokenAttr = escapeAttr(email.refresh_token || "");
      const safeClientIdAttr = escapeAttr(email.client_id || "");
      const safeDisplayPassTn = escapeHtml(displayPassTn);
      const safeAllInfoAttr = escapeAttr(
        `${email.email}|${email.password_email}|${
          email.refresh_token || ""
        }|${email.client_id || ""}`,
      );

      row.innerHTML = `
                        <td>
                            ${
                              showCheckbox
                                ? '<input type="checkbox" class="email-checkbox" data-email="' +
                                  safeEmailAttr +
                                  '" ' +
                                  (email.is_reg_acc ? "disabled" : "") +
                                  ">"
                                : '<span class="status-x">✕</span>'
                            }
                        </td>
                        <td>${String(index + 1).padStart(3, "0")}</td>
                        <td class="email-cell">${safeEmail}</td>
                        <td class="password-tn-cell" data-password="${safeDisplayPassTn}">${safeDisplayPassTn}</td>
                        <td>
                            <button class="btn btn-sm btn-primary copy-btn" 
                                    data-clipboard-text="${safeAllInfoAttr}"
                                    title="Copy all information">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="btn btn-sm btn-secondary copy-email-btn" 
                                    data-clipboard-text="${safeEmailAttr}"
                                    title="Copy email name">
                                <i class="fas fa-at"></i>
                            </button>
                            <button class="btn btn-sm btn-warning copy-password-btn" 
                                    data-clipboard-text="${safePasswordEmailAttr}"
                                    title="Copy email password">
                                <i class="fas fa-key"></i>
                            </button>
                        </td>
                        <td class="area-phone-cell">
                            <input type="text" class="form-control area-phone-input" value="${escapeAttr(
                              email.area_phone || "",
                            )}" data-email="${safeEmailAttr}" style="width: 80px; text-align: center;" ${
                              email.is_reg_acc ? "disabled" : ""
                            }>
                        </td>
                        <td>
                            <select class="form-select status-select" data-email="${safeEmailAttr}" data-type="tn" ${
                              email.is_reg_acc ? "disabled" : ""
                            }>
                                ${tnOptionsHtml}
                            </select>
                        </td>
                        <td>
                            <select class="form-select status-select" data-email="${safeEmailAttr}" data-type="tf" ${
                              email.is_reg_acc ? "disabled" : ""
                            }>
                                ${tfOptionsHtml}
                            </select>
                        </td>
                        <!-- TT status cell (disabled for now)
                        <td>
                            <select class="form-select status-select" data-email="${
                              email.email
                            }" data-type="tt" ${
                              email.is_reg_acc ? "disabled" : ""
                            }>
                                <option value="new"${
                                  email.status_account_TT === "new"
                                    ? " selected"
                                    : ""
                                }>New</option>
                                <option value="success"${
                                  email.status_account_TT === "success"
                                    ? " selected"
                                    : ""
                                }>Success</option>
                                <option value="error"${
                                  email.status_account_TT === "error"
                                    ? " selected"
                                    : ""
                                }>Error</option>
                                <option value="not reg"${
                                  email.status_account_TT === "not reg"
                                    ? " selected"
                                    : ""
                                }>Not Reg</option>
                            </select>
                        </td>
                        -->
                        <td>
                            <div class="mail-action-container">
                                <button class="btn btn-sm btn-info read-mail-tn-btn" title="Read TN mail" data-email="${
                                  email.email
                                }" data-password-email="${
                                  email.password_email
                                }" data-refresh-token="${email.refresh_token || ""}" data-client-id="${
                                  email.client_id || ""
                                }">
                                    <i class="fas fa-envelope-open-text"></i>
                                </button>
                                ${
                                  tnCode && tnCode !== "[object Object]"
                                    ? `<span class="mail-code-info"> ${tnCode}</span>`
                                    : ""
                                }
                            </div>
                        </td>
                        <td>
                            <div class="mail-action-container">
                                <button class="btn btn-sm btn-info read-mail-tf-btn" title="Read TF mail" data-email="${
                                  email.email
                                }" data-password-email="${
                                  email.password_email
                                }" data-refresh-token="${email.refresh_token || ""}" data-client-id="${
                                  email.client_id || ""
                                }">
                                    <i class="fas fa-envelope-open-text"></i>
                                </button>
                                ${
                                  tfCode && tfCode !== "[object Object]"
                                    ? `<span class="mail-code-info"> ${tfCode}</span>`
                                    : ""
                                }
                            </div>
                        </td>
                    `;
      frag.appendChild(row);
    });
    emailsTableBody.appendChild(frag);

    // Lưu một lần các cập nhật mật khẩu đã thêm hậu tố
    if (needSavePassFix) {
      try {
        localStorage.setItem(
          "employee_worksession",
          JSON.stringify(storedSession),
        );
      } catch (_) {}
    }

    // Cập nhật màu sắc cho các ô chọn trạng thái
    updateSelectStyles();
    // Thêm bộ đếm trạng thái TN
    renderStatusTnCounter(filteredEmails);
    // Hàm đếm và hiển thị tổng số lượng trạng thái TF (trừ 'mới', 'lỗi')
    renderStatusTfCounter(filteredEmails);
    // Thêm bộ đếm trạng thái TT
    renderStatusTtCounter(filteredEmails);
  } else {
    emailsTableBody.innerHTML = `
                    <tr class="no-email-row">
                        <td colspan="10" class="text-center">No available email</td>
                    </tr>
                `;
    renderStatusTnCounter([]);
    renderStatusTfCounter([]);
    renderStatusTtCounter([]);
  }
  toggleRegAccButton();
  // Thêm class row-disabled cho các dòng có checkbox bị disable
  document.querySelectorAll("#emailsTableBody tr").forEach((row) => {
    const checkbox = row.querySelector(".email-checkbox");
    if (checkbox && checkbox.disabled) {
      row.classList.add("row-disabled");
    } else if (checkbox) {
      row.classList.remove("row-disabled");
    }
  });
}
// Hàm chỉ update style cho 1 select
function updateSelectStyleForOne(select) {
  const selectedValue = select.value;
  select.style.backgroundColor = "";
  select.style.color = "";
  if (selectedValue === "new") {
    select.style.backgroundColor = "#fff";
    select.style.color = "#495057";
  } else if (selectedValue === "success") {
    select.style.backgroundColor = "#d4edda";
    select.style.color = "#198754";
  } else if (selectedValue === "error") {
    select.style.backgroundColor = "#f8d7da";
    select.style.color = "#dc3545";
  } else if (
    selectedValue === "other password" ||
    selectedValue === "not reg"
  ) {
    select.style.backgroundColor = "#e2e3e5";
    select.style.color = "#383d41";
  } else if (selectedValue === "resend link") {
    select.style.backgroundColor = "#e0c3fc";
    select.style.color = "#6f42c1";
  } else if (selectedValue === "verified") {
    select.style.backgroundColor = "#befcff";
    select.style.color = "#1c7430";
  }
}
// Hàm cập nhật màu sắc cho các ô chọn trạng thái (Table 1 và Table 2)
function updateSelectStyles() {
  const selects = document.querySelectorAll(
    ".status-select, .status-select-gr",
  );

  selects.forEach((select) => {
    const selectedValue = select.value;

    // Reset styles
    select.style.backgroundColor = "";
    select.style.color = "";

    // Apply styles based on value
    if (selectedValue === "new") {
      select.style.backgroundColor = "#fff"; // nền trắng
      select.style.color = "#495057"; // chữ xám đậm
    } else if (selectedValue === "success") {
      select.style.backgroundColor = "#d4edda"; // xanh lá cây nhạt
      select.style.color = "#198754"; // xanh lá cây đậm
    } else if (selectedValue === "error") {
      select.style.backgroundColor = "#f8d7da"; // đỏ nhạt
      select.style.color = "#dc3545"; // đỏ đậm
    } else if (selectedValue === "other password") {
      select.style.backgroundColor = "#e2e3e5";
      select.style.color = "#383d41";
    } else if (selectedValue === "not reg") {
      select.style.backgroundColor = "#e2e3e5";
      select.style.color = "#383d41";
    } else if (selectedValue === "resend link") {
      select.style.backgroundColor = "#e0c3fc"; // tím nhạt
      select.style.color = "#6f42c1"; // tím đậm
    } else if (selectedValue === "verified") {
      select.style.backgroundColor = "#befcff"; // xanh da trời nhạt
      select.style.color = "#1c7430"; // xanh da trời đậm
    }

    // Lắng nghe sự kiện thay đổi giá trị
    // select.addEventListener('change', function() {
    //     updateSelectStyles(); // Cập nhật lại màu sắc khi giá trị thay đổi
    // });
  });
}
// Hiển thị số lượng mail dự trữ
function updateReservedEmailCount() {
  const badge = document.getElementById("reservedEmailCount");
  if (!badge) return;
  let url;
  if (
    typeof currentTableType !== "undefined" &&
    currentTableType === "gmail_recovery"
  ) {
    url =
      "/api/gmail-recovery-count/?office=" +
      encodeURIComponent(userOffice || "");
  } else {
    url = "/api/get-reserved-email-count/";
  }
  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        badge.textContent = data.count != null ? data.count : "?";
      } else {
        badge.textContent = "?";
      }
    })
    .catch(() => {
      badge.textContent = "?";
    });
}
// Hàm để hiển thị dữ liệu từ localStorage
function displayEmailsFromStorage() {
  const serverEmails = window.initialEmails || [];
  // Đọc dữ liệu đã lưu cục bộ (ưu tiên localStorage, không ghi đè)
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem("employee_worksession") || "[]");
  } catch (_) {}
  // Merge: thêm các email từ server mà chưa có trong localStorage
  const mergedSet = new Set(stored.map((e) => e.email));
  serverEmails.forEach((e) => {
    if (e?.email && !mergedSet.has(e.email)) {
      stored.push(e);
    }
  });
  // Chuẩn hóa pass ngay ở bước nạp dữ liệu lần đầu
  const finalized = finalizeTodayPasswords(stored);
  localStorage.setItem("employee_worksession", JSON.stringify(finalized));
  displayEmails(finalized);
}

// Chuẩn hóa pass_TN cho email hiển thị hôm nay theo chuẩn base + No(3) + '@'
function finalizeTodayPasswords(emails) {
  try {
    const passTnFromDom = (
      document.getElementById("passTnInfo")?.textContent || ""
    )
      .replace(/^TN password:\s*/i, "")
      .trim();

    // Validate password - không cho phép sử dụng '[No data]' hoặc '[Error]' làm base password
    const isValidPassword =
      passTnFromDom &&
      passTnFromDom !== "[No data]" &&
      passTnFromDom !== "[Error]" &&
      passTnFromDom.length > 0;

    if (!isValidPassword) {
      // Hiển thị warning modal
      showPasswordWarningModal(passTnFromDom);
      return emails; // Trả về emails gốc nếu password không hợp lệ
    }

    const today = new Date();
    const formattedDate = formatDateDDMMYYYY(today);

    const seen = new Set();
    const todayList = [];
    emails.forEach((item) => {
      let emailDate = "";
      const rawDate = item.date || item.date_get || "";
      if (rawDate) {
        const parsedDate = formatDateDDMMYYYY(rawDate);
        if (parsedDate) {
          emailDate = parsedDate;
        }
      }
      if (emailDate === formattedDate && !seen.has(item.email)) {
        seen.add(item.email);
        todayList.push(item);
      }
    });

    todayList.forEach((e, idx) => {
      // Kiểm tra nếu có password custom (không trùng base và không match pattern base + No + '@')
      const defaultFormat = /^.+\d{3}@$/;
      const hasCustomPassword =
        e.pass_TN &&
        e.pass_TN !== passTnFromDom &&
        !defaultFormat.test(e.pass_TN);

      // Chỉ override pass_TN nếu KHÔNG có password custom
      if (!hasCustomPassword) {
        const hasSuffix = e.pass_TN && /^.+\d{3}@$/.test(e.pass_TN);
        if (!hasSuffix) {
          const noText = String(idx + 1).padStart(3, "0");
          e.pass_TN = passTnFromDom + noText + "@";
        }
      }
      // Nếu có password custom thì giữ nguyên pass_TN
    });

    try {
      localStorage.setItem("employee_worksession", JSON.stringify(emails));
    } catch (_) {}
  } catch (_) {}
  return emails;
}

// Các hàm xử lý modal
function closeAllModals() {
  const modals = [
    "mailListModal",
    "purchaseModal",
    "passwordModal",
    "confirmFetchModal",
    "passwordInputModal",
    "passwordWarningModal",
  ];
  modals.forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "none";
    }
  });
  document.body.style.overflow = "auto";
}

function showPasswordInputModal() {
  const modal = document.getElementById("passwordInputModal");
  modal.style.display = "block";
  document.getElementById("newPasswordInput").value = "";
  document.getElementById("newPasswordInput").focus();
}

function closePasswordInputModal() {
  const modal = document.getElementById("passwordInputModal");
  modal.style.display = "none";
  if (currentSelect) {
    currentSelect.value =
      currentSelect.getAttribute("data-previous-value") || "";
  }
  currentSelect = null;
}

// Thêm hàm xử lý modal warning
function showPasswordWarningModal(passwordStatus) {
  const modal = document.getElementById("passwordWarningModal");
  const statusText = document.getElementById("passwordStatusText");
  if (modal && statusText) {
    statusText.textContent = passwordStatus || "[No data]";
    modal.style.display = "block";
    document.body.style.overflow = "hidden";
  }
}

function closePasswordWarningModal() {
  const modal = document.getElementById("passwordWarningModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

// Modal chọn status hàng loạt (Textnow/Textfree)
function showBulkStatusModal(tableType, field) {
  const modal = document.getElementById("bulkStatusModal");
  const select = document.getElementById("bulkStatusSelect");
  if (!modal || !select) return;

  currentBulkStatusTableType = tableType || "normal";
  currentBulkStatusField = field || "tn";

  // Cập nhật tiêu đề theo cột được chọn
  const titleEl = modal.querySelector(".modal-title");
  if (titleEl) {
    if (currentBulkStatusField === "tf") {
      titleEl.textContent = "Change All Textfree Status";
    } else {
      titleEl.textContent = "Change All Textnow Status";
    }
  }

  // Hiển thị/ẩn option 'Verified' phù hợp với cột
  Array.from(select.options).forEach((opt) => {
    if (opt.value === "verified") {
      // Textfree không có trạng thái 'verified'
      opt.style.display = currentBulkStatusField === "tf" ? "none" : "";
    }
  });
  // Reset về 'new' mỗi lần mở
  select.value = "new";

  modal.style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeBulkStatusModal() {
  const modal = document.getElementById("bulkStatusModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

function confirmBulkStatusChange() {
  const select = document.getElementById("bulkStatusSelect");
  if (!select) return;

  const newStatus = select.value;
  if (!newStatus) {
    alert("Please select a status!");
    return;
  }

  // Không hỗ trợ "other password" trong bulk-change
  if (newStatus === "other password") {
    alert(
      'Bulk change does not support "Other password". Please set it per-row.',
    );
    return;
  }

  if (currentBulkStatusTableType === "gmail_recovery") {
    // Bảng Gmail Recovery
    const storedData = localStorage.getItem("employee_worksession_gr");
    if (!storedData) {
      closeBulkStatusModal();
      return;
    }

    const emails = JSON.parse(storedData) || [];
    let hasChanges = false;

    emails.forEach((email) => {
      if (email.is_reg_acc) return;
      if (currentBulkStatusField === "tf") {
        if (email.status_account_TF !== newStatus) {
          email.status_account_TF = newStatus;
          hasChanges = true;
        }
      } else {
        if (email.status_account_TN !== newStatus) {
          email.status_account_TN = newStatus;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      localStorage.setItem("employee_worksession_gr", JSON.stringify(emails));

      const selector =
        currentBulkStatusField === "tf"
          ? '#emailsTableBodyGR .status-select-gr[data-type="tf"]'
          : '#emailsTableBodyGR .status-select-gr[data-type="tn"]';

      document.querySelectorAll(selector).forEach((selectEl) => {
        if (!selectEl.disabled) {
          selectEl.value = newStatus;
          updateSelectStyleForOne(selectEl);
        }
      });

      renderStatusTnCounterGR(emails);
      renderStatusTfCounterGR(emails);

      emails.forEach((email) => {
        updateCheckboxVisibilityGR(email.email);
      });
    }
  } else {
    // Bảng thường
    const storedData = localStorage.getItem("employee_worksession");
    if (!storedData) {
      closeBulkStatusModal();
      return;
    }

    const emails = JSON.parse(storedData) || [];
    let hasChanges = false;

    emails.forEach((email) => {
      if (email.is_reg_acc) return;
      if (currentBulkStatusField === "tf") {
        if (email.status_account_TF !== newStatus) {
          email.status_account_TF = newStatus;
          hasChanges = true;
        }
      } else {
        if (email.status_account_TN !== newStatus) {
          email.status_account_TN = newStatus;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      localStorage.setItem("employee_worksession", JSON.stringify(emails));

      const selector =
        currentBulkStatusField === "tf"
          ? '#emailsTableBody .status-select[data-type="tf"]'
          : '#emailsTableBody .status-select[data-type="tn"]';

      document.querySelectorAll(selector).forEach((selectEl) => {
        if (!selectEl.disabled) {
          selectEl.value = newStatus;
          updateSelectStyleForOne(selectEl);
        }
      });

      renderStatusTnCounter(emails);
      renderStatusTfCounter(emails);
      renderStatusTtCounter(emails);

      emails.forEach((email) => {
        updateCheckboxVisibility(email.email);
      });

      // Bỏ chọn tất cả checkbox sau khi đổi trạng thái
      document
        .querySelectorAll(".email-checkbox:checked")
        .forEach((cb) => (cb.checked = false));
      const selectAllCheckbox = document.getElementById("selectAll");
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      toggleRegAccButton();
    }
  }

  closeBulkStatusModal();
}

function confirmNewPassword() {
  const newPassword = document.getElementById("newPasswordInput").value;
  if (!newPassword) {
    alert("Please enter a new password!");
    return;
  }

  if (currentSelect) {
    const email = currentSelect.getAttribute("data-email");
    const type = currentSelect.getAttribute("data-type");
    let storedData = localStorage.getItem("employee_worksession");
    if (storedData) {
      let emails = JSON.parse(storedData);
      const idx = emails.findIndex((e) => e.email === email);
      if (idx !== -1) {
        if (type === "tn") {
          emails[idx].pass_TN = newPassword;
          emails[idx].status_account_TN = "verified"; // Set status thành "Verified" sau khi nhập password
        } else if (type === "tf") {
          emails[idx].pass_TF = newPassword;
          emails[idx].status_account_TF = "success"; // Set status thành "Success" sau khi nhập password
        }
        localStorage.setItem("employee_worksession", JSON.stringify(emails));
        displayEmails(emails);
      }
    }
  }
  closePasswordInputModal();
}

document.addEventListener("DOMContentLoaded", function () {
  // Double-click header để đổi toàn bộ status TN/TF
  const textnowStatusHeader = document.getElementById("textnowStatusHeader");
  if (textnowStatusHeader) {
    textnowStatusHeader.addEventListener("dblclick", function () {
      showBulkStatusModal("normal", "tn");
    });
  }
  const textfreeStatusHeader = document.getElementById("textfreeStatusHeader");
  if (textfreeStatusHeader) {
    textfreeStatusHeader.addEventListener("dblclick", function () {
      showBulkStatusModal("normal", "tf");
    });
  }
  const textnowStatusHeaderGR = document.getElementById(
    "textnowStatusHeaderGR",
  );
  if (textnowStatusHeaderGR) {
    textnowStatusHeaderGR.addEventListener("dblclick", function () {
      showBulkStatusModal("gmail_recovery", "tn");
    });
  }
  const textfreeStatusHeaderGR = document.getElementById(
    "textfreeStatusHeaderGR",
  );
  if (textfreeStatusHeaderGR) {
    textfreeStatusHeaderGR.addEventListener("dblclick", function () {
      showBulkStatusModal("gmail_recovery", "tf");
    });
  }

  // Toggle between tables
  const toggleBtn = document.getElementById("toggleTableBtn");
  const normalContainer = document.querySelector(".email-table");
  const grContainer = document.getElementById("gmailRecoveryContainer");
  function applyToggleUI() {
    if (currentTableType === "normal") {
      normalContainer.style.display = "";
      grContainer.style.display = "none";
      toggleBtn.textContent = "Table 1";
      // Show normal controls, hide GR-specific top duplicates
      const fetchBtn = document.getElementById("fetchEmailsBtn");
      const setAreaBtn = document.getElementById("setAreaCodeBtn");
      const regBtn = document.getElementById("regAccBtn");
      const regBtnGR = document.getElementById("regAccBtnGR");
      const setAreaBtnGR = document.getElementById("setAreaCodeBtnGR");
      if (fetchBtn) fetchBtn.style.display = "";
      if (setAreaBtn) setAreaBtn.style.display = "";
      if (regBtn) {
        // Keep regBtn visibility controlled by selection; don't force show
        // but ensure it's not hidden from GR state
        if (regBtn.dataset.forceHidden === "1") {
          regBtn.style.display = "none";
        }
      }
      if (regBtnGR) regBtnGR.style.display = "none";
      if (setAreaBtnGR) setAreaBtnGR.style.display = "none";
      updateReservedEmailCount();
      // Show 'Copy all' button for Table 1
      const copyAllBtn = document.getElementById("copyAllBtn");
      if (copyAllBtn) copyAllBtn.style.display = "inline-block";
    } else {
      normalContainer.style.display = "none";
      grContainer.style.display = "";
      toggleBtn.textContent = "Table 2";
      // Hide normal action buttons to avoid duplicates with GR toolbar
      const fetchBtn = document.getElementById("fetchEmailsBtn");
      const setAreaBtn = document.getElementById("setAreaCodeBtn");
      const regBtn = document.getElementById("regAccBtn");
      const regBtnGR = document.getElementById("regAccBtnGR");
      const setAreaBtnGR = document.getElementById("setAreaCodeBtnGR");
      // Keep fetchBtn visible for Table 2
      // if (fetchBtn) fetchBtn.style.display = "none";
      if (setAreaBtn) setAreaBtn.style.display = "none";
      if (regBtn) regBtn.style.display = "none";
      if (regBtnGR) {
        // Keep regBtnGR visibility controlled by selection; don't force show
        // but ensure it's not hidden from normal state
        if (regBtnGR.dataset.forceHidden === "1") {
          regBtnGR.style.display = "none";
        }
      }
      if (setAreaBtnGR) setAreaBtnGR.style.display = "";
      updateReservedEmailCount();
      // Hide 'Copy all' button for Table 2
      const copyAllBtn = document.getElementById("copyAllBtn");
      if (copyAllBtn) copyAllBtn.style.display = "none";
    }
  }
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      currentTableType =
        currentTableType === "normal" ? "gmail_recovery" : "normal";
      applyToggleUI();
      if (currentTableType === "gmail_recovery") {
        if (!gmailRecoveryEmails.length) loadGmailRecoveryEmails();
      }
    });
  }
  applyToggleUI();
  // Handle Get iCloud button
  const getIcloudBtn = document.getElementById("getIcloudBtn");
  const getSmsBtn = document.getElementById("getSmsBtn");
  // Lease renew timer
  let icloudLeaseTimer = null;
  async function renewIcloudLease() {
    try {
      const csrf =
        (document.querySelector('meta[name="csrf-token"]') || {}).content || "";
      await fetch("/api/icloud/renew/", {
        method: "POST",
        headers: { "X-CSRFToken": csrf },
      });
    } catch (e) {
      // ignore renew errors
    }
  }

  if (getIcloudBtn) {
    getIcloudBtn.addEventListener("click", async function () {
      const btn = this;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1"></span>Loading...';
      try {
        const csrf =
          (document.querySelector('meta[name="csrf-token"]') || {}).content ||
          "";
        console.log("[iCloud][CLICK] Release then Allocate");
        // 1) Always release current icloud first (if any), then allocate a new one
        try {
          const fd = new FormData();
          if (csrf) fd.append("csrfmiddlewaretoken", csrf);
          const rel = await fetch("/api/icloud/release/", {
            method: "POST",
            body: fd,
            credentials: "same-origin",
          });
          const relJson = await rel.json().catch(() => ({}));
          console.log("[iCloud][RELEASE][RES]", rel.status, relJson);
        } catch (_) {
          /* ignore release errors */
        }

        console.log("[iCloud][ALLOCATE][REQ]");
        const allocRes = await fetch("/api/icloud/allocate/", {
          method: "POST",
          headers: { "X-CSRFToken": csrf },
        });
        const allocData = await allocRes.json();
        console.log("[iCloud][ALLOCATE][RES]", allocRes.status, allocData);
        if (!allocData.success) {
          alert(allocData.message || "No icloud account available");
          return;
        }
        // 2) Fetch details using existing endpoint
        console.log("[iCloud][DETAIL][REQ]");
        const res = await fetch("/api/get-icloud-account/");
        const data = await res.json();
        console.log("[iCloud][DETAIL][RES]", res.status, data);
        if (!data.success) {
          alert(data.error || "No icloud account available");
          return;
        }
        const info = data.data || {};
        const idEl = document.getElementById("icloudIdInfo");
        const pwEl = document.getElementById("icloudPasswordInfo");
        const phoneEl = document.getElementById("icloudNumberInfo");
        const otpEl = document.getElementById("icloudOtpCodeInfo");
        if (idEl) idEl.textContent = "ID: " + (info.id || "");
        if (pwEl) pwEl.textContent = "Password: " + (info.password || "");
        if (phoneEl)
          phoneEl.textContent = "Numberphone: " + (info.numberphone || "");
        if (otpEl) {
          otpEl.textContent = "OTP Code: ";
          otpEl.dataset.otpLink = info.otp_link || "";
        }
        // 3) Start/refresh lease renewal every 15 minutes
        if (icloudLeaseTimer) clearInterval(icloudLeaseTimer);
        icloudLeaseTimer = setInterval(
          () => {
            console.log("[iCloud][RENEW][TIMER] tick");
            renewIcloudLease();
          },
          14 * 60 * 1000,
        );
        // Update button state (optional UI hint)
        // btn.textContent = 'Get iCloud (New)';
      } catch (e) {
        console.error("allocate/get icloud error", e);
        alert("An error occurred while allocating icloud account");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  }

  // Release icloud on pagehide to return account to pool
  (function setupIcloudReleaseOnExit() {
    let released = false;
    async function releaseIcloud() {
      if (released) return;
      released = true;
      try {
        const url = "/api/icloud/release/";
        const fd = new FormData();
        const csrf =
          (document.querySelector('meta[name="csrf-token"]') || {}).content ||
          "";
        if (csrf) fd.append("csrfmiddlewaretoken", csrf);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, fd);
        } else {
          fetch(url, {
            method: "POST",
            body: fd,
            keepalive: true,
            credentials: "same-origin",
          }).catch(function () {});
        }
      } catch (_) {}
    }
    window.addEventListener("pagehide", releaseIcloud);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") releaseIcloud();
    });
  })();
  if (getSmsBtn) {
    getSmsBtn.addEventListener("click", async function () {
      // Validate iCloud ID exists
      const idEl = document.getElementById("icloudIdInfo");
      const currentId =
        idEl && idEl.textContent
          ? idEl.textContent.replace(/^ID:\s*/i, "").trim()
          : "";
      if (!currentId) {
        alert("Please fetch iCloud account first.");
        return;
      }

      const btn = this;
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1"></span>Loading...';
      try {
        const otpEl = document.getElementById("icloudOtpCodeInfo");
        const otpLink = otpEl ? otpEl.dataset.otpLink || "" : "";
        if (!otpLink) {
          alert("Missing OTP link. Please fetch iCloud account again.");
          return;
        }
        const res = await fetch(
          "/api/get-sms-account/?otp_link=" + encodeURIComponent(otpLink),
        );
        const data = await res.json();
        console.log("data", data);
        if (!data.success) {
          alert(data.error || "No sms account available");
          return;
        }
        const otpCodeEl = document.getElementById("icloudOtpCodeInfo");
        if (otpCodeEl)
          otpCodeEl.textContent =
            "OTP Code: " + (data.data.otp_code || "[Null]");
      } catch (e) {
        console.error("get sms error", e);
        alert("An error occurred while getting sms account");
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  }
  // Gọi hàm lấy office khi trang load
  getUserOffice();
  // Cập nhật trạng thái button ban đầu (disable cho đến khi có password hợp lệ)
  updateFetchButtonState();
  //  Gọi hàm lấy pass tn tf
  getEmployeePasswords();
  //  Việc render bảng sẽ được gọi sau khi lấy được mật khẩu (trong getEmployeePasswords)
  // Xóa code cũ
  cleanupOldMailCodes();
  // Xóa email cũ
  cleanupOldEmails();

  // Thêm event listener cho button set mã vùng
  const setAreaCodeBtn = document.getElementById("setAreaCodeBtn");
  if (setAreaCodeBtn) {
    setAreaCodeBtn.addEventListener("click", showSetAreaCodeModal);
  }

  // Thêm validation cho input mã vùng trong modal
  const areaCodeInput = document.getElementById("areaCodeInput");
  if (areaCodeInput) {
    areaCodeInput.addEventListener("input", function (e) {
      // Chỉ cho phép nhập số và có độ dài tối đa 3 ký tự
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    });
  }
  // Thêm code xử lý chuyển đổi hình ảnh QR code (tách biệt 2 widget)
  const qrCodeImage = document.getElementById("qrCodeImage");
  const qrCodeName = document.getElementById("qrCodeName");
  const qrCodeSelect = document.getElementById("qrCodeSelect");
  const qrCodeImageVn = document.getElementById("qrCodeImageVn");
  const qrCodeNameVn = document.getElementById("qrCodeNameVn");
  const qrCodeSelectVn = document.getElementById("qrCodeSelectVn");

  function updateMainUI() {
    if (!qrCodesMain.length) return;
    const item = qrCodesMain[currentIndexMain];
    if (qrCodeImage) qrCodeImage.src = item.src;
    if (qrCodeName) qrCodeName.textContent = item.name;
    if (qrCodeSelect) qrCodeSelect.selectedIndex = currentIndexMain;
  }
  function updateVnUI() {
    if (!qrCodesVn.length) return;
    const item = qrCodesVn[currentIndexVn];
    if (qrCodeImageVn) qrCodeImageVn.src = item.src;
    if (qrCodeNameVn) qrCodeNameVn.textContent = item.name;
    if (qrCodeSelectVn) qrCodeSelectVn.selectedIndex = currentIndexVn;
  }

  function nextQrMain() {
    if (!qrCodesMain.length) return;
    currentIndexMain = (currentIndexMain + 1) % qrCodesMain.length;
    updateMainUI();
  }
  function nextQrVn() {
    if (!qrCodesVn.length) return;
    currentIndexVn = (currentIndexVn + 1) % qrCodesVn.length;
    updateVnUI();
  }

  if (qrCodeImage) qrCodeImage.addEventListener("click", nextQrMain);
  if (qrCodeImageVn) qrCodeImageVn.addEventListener("click", nextQrVn);

  if (qrCodeSelect)
    qrCodeSelect.addEventListener("change", function () {
      const newIndex = parseInt(this.value, 10);
      if (!isNaN(newIndex) && qrCodesMain[newIndex]) {
        currentIndexMain = newIndex;
        updateMainUI();
      }
    });
  if (qrCodeSelectVn)
    qrCodeSelectVn.addEventListener("change", function () {
      const newIndex = parseInt(this.value, 10);
      if (!isNaN(newIndex) && qrCodesVn[newIndex]) {
        currentIndexVn = newIndex;
        updateVnUI();
      }
    });

  // Swap position handlers
  function swapQrPositions() {
    const main = document.querySelector(".qr-tools");
    const vn = document.querySelector(".qr-tools-vn");
    if (!main || !vn) return;
    main.classList.toggle("on-right");
    vn.classList.toggle("on-left");
  }
  const swapBtnMain = document.getElementById("swapQrBtnMain");
  const swapBtnVn = document.getElementById("swapQrBtnVn");
  if (swapBtnMain) swapBtnMain.addEventListener("click", swapQrPositions);
  if (swapBtnVn) swapBtnVn.addEventListener("click", swapQrPositions);

  // Logic cho option 'Mật khẩu khác'
  function attachPasswordKhacHandler() {
    // Gắn event listener vào bảng thay vì từng select
    document
      .getElementById("emailsTableBody")
      .addEventListener("change", function (e) {
        if (
          e.target.classList.contains("status-select") &&
          e.target.value === "other password"
        ) {
          // Lưu giá trị ban đầu của email (từ localStorage) để rollback nếu Cancel
          const email = e.target.getAttribute("data-email");
          const type = e.target.getAttribute("data-type");
          let storedData = localStorage.getItem("employee_worksession");
          if (storedData) {
            let emails = JSON.parse(storedData);
            const emailData = emails.find((e) => e.email === email);
            if (emailData) {
              const previousStatus =
                type === "tn"
                  ? emailData.status_account_TN
                  : emailData.status_account_TF;
              e.target.setAttribute(
                "data-previous-value",
                previousStatus || "new",
              );
            }
          }

          // Chỉnh hiển thị dropdown thành success (tạm thời)
          e.target.value = "success";
          currentSelect = e.target;
          showPasswordInputModal();
        }
      });
  }

  // Gọi khi trang load lần đầu
  attachPasswordKhacHandler();

  // Click-to-copy for header TN/TF passwords
  (function setupHeaderPasswordCopy() {
    function setup(elId, prefixRegex) {
      const el = document.getElementById(elId);
      if (!el) return;
      el.style.cursor = "pointer";
      el.title = "Click to copy password";
      el.addEventListener("click", async function (ev) {
        const text = (el.textContent || "").replace(prefixRegex, "").trim();
        if (!text || text === "[No data]" || text === "[Error]") return;
        const highlight = () => {
          const originalBg = el.style.backgroundColor;
          const originalBorder = el.style.borderColor;
          el.style.backgroundColor = "#d4edda";
          el.style.border = "1px solid #198754";
          setTimeout(() => {
            el.style.backgroundColor = originalBg;
            el.style.border = originalBorder || "";
          }, 600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            highlight();
          } catch (_) {}
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            highlight();
          } catch (_) {}
          document.body.removeChild(ta);
        }
        ev.stopPropagation();
      });
    }
    setup("passTnInfo", /^TN\s*password:\s*/i);
    setup("passTfInfo", /^TF\s*password:\s*/i);
  })();

  const fetchEmailsBtn = document.getElementById("fetchEmailsBtn");
  const confirmFetchModal = document.getElementById("confirmFetchModal");

  // Hiển thị modal xác nhận khi bấm nút "Lấy Email Dự Trữ"
  fetchEmailsBtn.addEventListener("click", function () {
    // Kiểm tra nếu button bị disable thì không làm gì
    if (fetchEmailsBtn.disabled) {
      return;
    }

    const loadingOverlay = document.querySelector(".loading-overlay");
    loadingOverlay.style.display = "flex";

    // Simulate a small delay to show loading (optional)
    setTimeout(() => {
      loadingOverlay.style.display = "none";
      confirmFetchModal.style.display = "block";
      document.body.style.overflow = "hidden"; // Ngăn cuộn trang khi modal mở
    }, 300);
  });

  // Hàm đóng modal xác nhận
  window.closeConfirmFetchModal = function () {
    confirmFetchModal.style.display = "none";
    document.body.style.overflow = "auto"; // Cho phép cuộn trang trở lại
  };

  // Hàm xác nhận và gọi API
  window.confirmFetchEmails = async function () {
    const loadingOverlay = document.querySelector(".loading-overlay");
    loadingOverlay.style.display = "flex";
    closeConfirmFetchModal();

    // Disable button to prevent double-click concurrent requests
    const fetchEmailsBtn = document.getElementById("fetchEmailsBtn");
    if (fetchEmailsBtn) {
      fetchEmailsBtn.disabled = true;
      fetchEmailsBtn.style.opacity = "0.6";
    }

    try {
      // Lấy số lượng từ input
      let quantity =
        parseInt(document.getElementById("fetchEmailQuantity").value) || 1;
      if (quantity < 1) quantity = 1;
      if (quantity > 20) quantity = 20;
      if (isNaN(quantity)) {
        alert("Please enter a valid number");
        return;
      }
      if (currentTableType === "gmail_recovery") {
        // Fetch & allocate from recovery collection (same flow as Table 1)
        const res = await fetch(
          `/api/available-recovery-emails/?quantity=${quantity}`,
        );
        const gr = await res.json();
        if (gr.success) {
          const existingDataGR = localStorage.getItem(
            "employee_worksession_gr",
          );
          let existingEmailsGR = [];
          if (existingDataGR) existingEmailsGR = JSON.parse(existingDataGR);
          const today = new Date();
          const formattedDate = formatDateDDMMYYYY(today);
          const newEmails = gr.data.map((email) => ({
            ...email,
            date: formattedDate,
            office: userOffice,
          }));
          const updatedGR = [...existingEmailsGR];
          newEmails.forEach((newEmail) => {
            if (!updatedGR.some((e) => e.email === newEmail.email)) {
              updatedGR.push({ ...newEmail, timestamp: Date.now() });
            }
          });
          // Persist pass_TN for GR: base + No(3) + '@' (same logic as Table 1, unless custom)
          try {
            const basePass = (
              document.getElementById("passTnInfo")?.textContent || ""
            )
              .replace(/^TN\s*password:\s*/i, "")
              .trim();
            const isValidBase =
              basePass && basePass !== "[No data]" && basePass !== "[Error]";
            if (isValidBase) {
              const todayStr = formattedDate; // DD/MM/YYYY
              const seen = new Set();
              const todayList = [];
              updatedGR.forEach((item) => {
                let emailDate = "";
                const rawDate =
                  item.date_get || item.date || item.created_at || "";
                if (rawDate) {
                  const parsedDate = formatDateDDMMYYYY(rawDate);
                  if (parsedDate) {
                    emailDate = parsedDate;
                  }
                }
                if (emailDate === todayStr && !seen.has(item.email)) {
                  seen.add(item.email);
                  todayList.push(item);
                }
              });
              todayList.forEach((e, idx) => {
                const hasCustom = e.pass_TN && !/(\d{3}@)$/.test(e.pass_TN);
                if (!hasCustom) {
                  const noText = String(idx + 1).padStart(3, "0");
                  e.pass_TN = basePass + noText + "@";
                }
              });
            }
          } catch (_) {}
          try {
            localStorage.setItem(
              "employee_worksession_gr",
              JSON.stringify(updatedGR),
            );
          } catch (_) {}
          gmailRecoveryEmails = updatedGR;
          displayEmailsGR(updatedGR);
          updateReservedEmailCount();
        } else {
          if (gr.missing_passwords) {
            showModal(gr.error);
          } else {
            alert(
              "An error occurred while fetching recovery emails" +
                (gr && gr.error ? ": " + gr.error : ""),
            );
          }
        }
        // Done for GR branch
        return;
      }
      const response = await fetch(
        `/api/available-emails/?quantity=${quantity}`,
      );
      const data = await response.json();

      if (data.success) {
        const existingData = localStorage.getItem("employee_worksession");
        let existingEmails = [];
        if (existingData) {
          existingEmails = JSON.parse(existingData);
        }

        // Thêm trường office vào từng email
        const newEmails = data.data.map((email) => {
          const today = new Date();
          const formattedDate = formatDateDDMMYYYY(today);
          return {
            ...email,
            date: formattedDate, // Thêm trường date (DD/MM/YYYY)
            office: userOffice, // Thêm trường office
          };
        });
        const updatedEmails = [...existingEmails];
        newEmails.forEach((newEmail) => {
          const existingIndex = updatedEmails.findIndex(
            (e) => e.email === newEmail.email,
          );
          if (existingIndex === -1) {
            // Thêm timestamp để có thể sắp theo thời gian nếu cần
            updatedEmails.push({ ...newEmail, timestamp: Date.now() });
          }
        });

        // Chuẩn hóa pass_TN ngay sau khi Accept để hiển thị đúng lập tức
        const finalized = finalizeTodayPasswords(updatedEmails);
        localStorage.setItem("employee_worksession", JSON.stringify(finalized));
        displayEmails(finalized);
        updateReservedEmailCount();
      } else {
        if (data.missing_passwords) {
          showModal(data.error);
        } else {
          alert("An error occurred while fetching data: " + data.error);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred while calling API");
    } finally {
      loadingOverlay.style.display = "none";
      // Re-enable button based on password validity state
      updateFetchButtonState();
    }
  };

  const regAccBtn = document.getElementById("regAccBtn");
  const buyDongVanBtn = document.getElementById("buyDongVanBtn");
  const buyFMailBtn = document.getElementById("buyFMailBtn");
  const buyPhapSuBtn = document.getElementById("buyPhapSuBtn");
  const selectAllCheckbox = document.getElementById("selectAll");
  const emailsTableBody = document.getElementById("emailsTableBody");

  // Xử lý sự kiện cho checkbox "Select All"
  selectAllCheckbox.addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".email-checkbox");
    checkboxes.forEach((checkbox) => {
      // Chỉ chọn những checkbox không bị disabled (is_reg_acc=false)
      if (!checkbox.disabled) {
        checkbox.checked = this.checked;
      }
    });
    toggleRegAccButton();
  });

  // Xử lý sự kiện cho các checkbox riêng lẻ
  emailsTableBody.addEventListener("change", function (e) {
    if (e.target.classList.contains("email-checkbox")) {
      // Kiểm tra nếu tất cả checkbox không bị disabled đều được chọn
      const checkboxes = document.querySelectorAll(
        ".email-checkbox:not([disabled])",
      );
      const allChecked = Array.from(checkboxes).every(
        (checkbox) => checkbox.checked,
      );
      selectAllCheckbox.checked = allChecked;
      toggleRegAccButton();
    }

    // Lưu dữ liệu khi thay đổi trạng thái
    if (e.target.classList.contains("status-select")) {
      const email = e.target.dataset.email;
      const type = e.target.dataset.type;
      const newStatus = e.target.value;
      updateStatusInStorage(email, type, newStatus, e.target);
      updateSelectStyleForOne(e.target);

      // Cập nhật hiển thị checkbox/X dựa trên trạng thái TN và TF
      updateCheckboxVisibility(email);

      // Thêm đoạn này để bỏ chọn tất cả checkbox
      document
        .querySelectorAll(".email-checkbox:checked")
        .forEach((cb) => (cb.checked = false));
      // Đồng thời bỏ check selectAll
      const selectAllCheckbox = document.getElementById("selectAll");
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      // Ẩn nút Reg Acc nếu có
      toggleRegAccButton();
    }

    // Xử lý sự kiện thay đổi mã vùng
    if (e.target.classList.contains("area-phone-input")) {
      const email = e.target.dataset.email;
      const newAreaPhone = e.target.value;
      updateAreaPhoneInStorage(email, newAreaPhone);
    }
  });

  // Hàm để lưu dữ liệu vào server
  async function saveWorksessionToServer() {
    const storedData = localStorage.getItem("employee_worksession");
    if (!storedData) return;

    try {
      const response = await fetch("/api/save-worksession/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: storedData,
      });
      const data = await response.json();
      if (!data.success) {
        console.error(
          "An error occurred while saving the work session:",
          data.error,
        );
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }
  // Expose to global scope for callers outside this block
  window.saveWorksessionToServer = saveWorksessionToServer;

  // Lưu dữ liệu khi đóng trang
  window.addEventListener("beforeunload", function (e) {
    // Lưu dữ liệu trước khi đóng trang
    saveWorksessionToServer();

    // Hiển thị thông báo xác nhận
    e.preventDefault();
    e.returnValue = "";
  });

  // Lưu dữ liệu khi tạo tài khoản
  if (regAccBtn) {
    regAccBtn.addEventListener("click", async function () {
      const checkedBoxes = document.querySelectorAll(".email-checkbox:checked");
      const selectedEmails = Array.from(checkedBoxes)
        .map((checkbox) => {
          const storedData = localStorage.getItem("employee_worksession");
          if (storedData) {
            const emails = JSON.parse(storedData);
            return emails.find((e) => e.email === checkbox.dataset.email);
          }
          return null;
        })
        .filter((email) => email !== null);

      // Validate area code before proceeding
      const missingArea = selectedEmails.filter(
        (e) => !e.area_phone || String(e.area_phone).trim() === "",
      );
      if (missingArea.length > 0) {
        alert(
          "Please set the phone area code for all selected emails before creating accounts.",
        );
        return;
      }

      if (selectedEmails.length > 0) {
        try {
          // Thêm class loading và disable nút
          regAccBtn.classList.add("loading");
          regAccBtn.disabled = true;
          regAccBtn.innerHTML =
            '<span class="btn-text">Reg Acc</span><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';

          // Tạo mật khẩu TN theo format: No(3 chữ số) + base(UI) + '@' cho từng email được chọn
          (function applyGeneratedPasswords() {
            try {
              const storedData = localStorage.getItem("employee_worksession");
              const emails = storedData ? JSON.parse(storedData) : [];
              selectedEmails.forEach((sel) => {
                // Kiểm tra nếu đã có password custom (không match pattern base + No + '@')
                const hasCustomPassword =
                  sel.pass_TN && !/(\d{3}@)$/.test(sel.pass_TN);

                // Chỉ override pass_TN nếu KHÔNG có password custom
                if (!hasCustomPassword) {
                  const row = document.querySelector(
                    'tr[data-email="' + sel.email + '"]',
                  );
                  let noText = "001";
                  if (row) {
                    const noCell = row.querySelector("td:nth-child(2)");
                    if (noCell && noCell.textContent)
                      noText = noCell.textContent.trim();
                  }
                  // Luôn dùng base từ UI (passTnInfo) để tránh nhân đôi hậu tố
                  const base = (
                    document.getElementById("passTnInfo")?.textContent || ""
                  )
                    .replace(/^TN password:\s*/i, "")
                    .trim();
                  if (base) {
                    const newPass = base + noText + "@";
                    sel.pass_TN = newPass;
                    const idx = emails.findIndex((e) => e.email === sel.email);
                    if (idx !== -1) emails[idx].pass_TN = newPass;
                  }
                }
                // Nếu đã có password custom thì giữ nguyên
              });
              localStorage.setItem(
                "employee_worksession",
                JSON.stringify(emails),
              );
            } catch (_) {
              /* ignore */
            }
          })();

          // Bổ sung/chuẩn hóa dữ liệu bắt buộc trước khi gửi
          const normalizedSelected = selectedEmails.map(function (sel) {
            // Đảm bảo date luôn ở format DD/MM/YYYY
            let finalDate = "";
            const rawDate = sel.date || sel.date_get || "";
            if (rawDate) {
              const parsedDate = formatDateDDMMYYYY(rawDate);
              if (parsedDate) {
                finalDate = parsedDate;
              } else {
                // Nếu không parse được, dùng date hiện tại
                finalDate = formatDateDDMMYYYY(new Date());
              }
            } else {
              // Nếu không có date, dùng date hiện tại
              finalDate = formatDateDDMMYYYY(new Date());
            }

            // Lấy status trực tiếp từ DOM để đảm bảo đồng bộ với UI
            const row = document.querySelector(
              'tr[data-email="' + sel.email + '"]',
            );
            let statusTN = sel.status_account_TN || "new";
            let statusTF = sel.status_account_TF || "new";
            if (row) {
              const tnSelect = row.querySelector(
                '.status-select[data-type="tn"]',
              );
              const tfSelect = row.querySelector(
                '.status-select[data-type="tf"]',
              );
              if (tnSelect && tnSelect.value) statusTN = tnSelect.value;
              if (tfSelect && tfSelect.value) statusTF = tfSelect.value;
            }

            return {
              email: sel.email,
              password_email: sel.password_email,
              pass_TN: sel.pass_TN || "",
              pass_TF: sel.pass_TF || "",
              status_account_TN: statusTN,
              status_account_TF: statusTF,
              supplier: sel.supplier || "",
              area_phone: sel.area_phone || "",
              refresh_token: sel.refresh_token || "",
              client_id: sel.client_id || "",
              office: sel.office || userOffice || "",
              date: finalDate,
            };
          });

          // Lấy CSRF token từ cookie
          function getCookie(name) {
            let cookieValue = null;
            if (document.cookie && document.cookie !== "") {
              const cookies = document.cookie.split(";");
              for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === name + "=") {
                  cookieValue = decodeURIComponent(
                    cookie.substring(name.length + 1),
                  );
                  break;
                }
              }
            }
            return cookieValue;
          }

          const csrftoken = getCookie("csrftoken");
          const response = await fetch("/api/create-textnow/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": csrftoken, // Thêm CSRF token vào đây nữa
            },
            body: JSON.stringify(normalizedSelected),
          });
          const data = await response.json();

          if (data.success) {
            const storedData = localStorage.getItem("employee_worksession");
            console.log(data.error_accounts);
            if (data.error_accounts.length > 0) {
              alert("An error occurred: " + data.error_accounts);
            }
            if (storedData) {
              const emails = JSON.parse(storedData);
              selectedEmails.forEach((selectedEmail) => {
                const emailIndex = emails.findIndex(
                  (e) => e.email === selectedEmail.email,
                );
                if (emailIndex !== -1) {
                  emails[emailIndex].is_reg_acc = true;
                }
              });
              localStorage.setItem(
                "employee_worksession",
                JSON.stringify(emails),
              );

              // Tối ưu: Chỉ cập nhật DOM thay vì render lại toàn bộ bảng
              selectedEmails.forEach((selectedEmail) => {
                // Tìm checkbox theo data-email
                const checkbox = document.querySelector(
                  '.email-checkbox[data-email="' + selectedEmail.email + '"]',
                );
                if (checkbox) {
                  // Disable checkbox
                  checkbox.disabled = true;
                  // Bỏ check nếu đang check
                  checkbox.checked = false;
                  // Thêm class row-disabled cho dòng cha và disable các control khác
                  const row = checkbox.closest("tr");
                  if (row) {
                    row.classList.add("row-disabled");
                    // Disable tất cả select trạng thái và input mã vùng trong dòng
                    row
                      .querySelectorAll(".status-select, .area-phone-input")
                      .forEach(function (el) {
                        el.disabled = true;
                      });
                  }
                } else {
                  // Fallback: tìm theo tr[data-email]
                  const row = document.querySelector(
                    'tr[data-email="' + selectedEmail.email + '"]',
                  );
                  if (row) {
                    row.classList.add("row-disabled");
                    const cb = row.querySelector(".email-checkbox");
                    if (cb) {
                      cb.disabled = true;
                      cb.checked = false;
                    }
                    row
                      .querySelectorAll(".status-select, .area-phone-input")
                      .forEach(function (el) {
                        el.disabled = true;
                      });
                  }
                }
              });

              // Cập nhật nút Reg Acc và Select All
              toggleRegAccButton();

              // Kiểm tra lại trạng thái Select All
              const checkboxes = document.querySelectorAll(
                ".email-checkbox:not([disabled])",
              );
              const allChecked = Array.from(checkboxes).every(
                (checkbox) => checkbox.checked,
              );
              const selectAllCheckbox = document.getElementById("selectAll");
              if (selectAllCheckbox) {
                selectAllCheckbox.checked = allChecked;
              }

              saveWorksessionToServer(); // Lưu sau khi tạo tài khoản
            }
            alert("Successfully created account");
          } else {
            alert("An error occurred: " + data.error);
          }
        } catch (error) {
          console.error("Error:", error);
          alert("An error occurred while calling API");
        } finally {
          // Xóa class loading và enable lại nút
          regAccBtn.classList.remove("loading");
          regAccBtn.disabled = false;
          regAccBtn.innerHTML = "Reg Acc";
          // Không cần cập nhật lại toàn bộ bảng vì đã cập nhật từng dòng ở trên
        }
      }
    });
  }

  // Hàm để cập nhật trạng thái trong localStorage (KHÔNG render lại bảng)
  function updateStatusInStorage(email, type, newStatus, selectElement) {
    const storedData = localStorage.getItem("employee_worksession");
    if (storedData) {
      const emails = JSON.parse(storedData);
      const emailIndex = emails.findIndex((e) => e.email === email);
      if (emailIndex !== -1) {
        if (type === "tn") {
          emails[emailIndex].status_account_TN = newStatus;
        } else if (type === "tf") {
          emails[emailIndex].status_account_TF = newStatus;
        } else if (type === "tt") {
          emails[emailIndex].status_account_TT = newStatus;
        }
        localStorage.setItem("employee_worksession", JSON.stringify(emails));
        // Chỉ update style cho select vừa đổi
        if (selectElement) updateSelectStyleForOne(selectElement);

        // Tối ưu: Cập nhật checkbox visibility real-time
        updateCheckboxVisibility(email);

        // Cập nhật badge tổng nếu cần
        renderStatusTnCounter(emails);
        renderStatusTfCounter(emails);
        renderStatusTtCounter(emails);
      }
    }
  }

  // Hàm cập nhật mã vùng trong localStorage
  function updateAreaPhoneInStorage(email, newAreaPhone) {
    try {
      const storedData = localStorage.getItem("employee_worksession");
      if (storedData) {
        const emails = JSON.parse(storedData);
        const emailIndex = emails.findIndex((e) => e.email === email);
        if (emailIndex !== -1) {
          emails[emailIndex].area_phone = newAreaPhone;
          localStorage.setItem("employee_worksession", JSON.stringify(emails));
          // Không cần gọi displayEmails vì chỉ thay đổi giá trị input
        }
      }
    } catch (error) {
      console.error("An error occurred while updating the area code:", error);
    }
  }

  // Hàm validation mã vùng
  function validateAreaPhone(input) {
    // Chỉ cho phép nhập số và có độ dài tối đa 3 ký tự
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, 3);
  }

  // Hiển thị dữ liệu từ localStorage khi trang được tải
  // displayEmailsFromStorage();

  var clipboard = null;
  try {
    if (window.ClipboardJS) {
      clipboard = new ClipboardJS(
        ".copy-btn, .copy-email-btn, .copy-password-btn",
      );
    }
  } catch (_) {
    clipboard = null;
  }
  if (clipboard)
    clipboard.on("success", function (e) {
      var triggerBtn = e && e.trigger ? e.trigger : null;
      if (
        !triggerBtn ||
        !(triggerBtn instanceof Element) ||
        !triggerBtn.classList
      ) {
        try {
          e && e.clearSelection && e.clearSelection();
        } catch (_) {}
        return;
      }
      try {
        triggerBtn.classList.remove(
          "btn-primary",
          "btn-secondary",
          "btn-warning",
        );
        triggerBtn.classList.add("btn-success");
        setTimeout(() => {
          try {
            if (triggerBtn && triggerBtn.classList) {
              triggerBtn.classList.remove("btn-success");
              if (triggerBtn.classList.contains("copy-email-btn")) {
                triggerBtn.classList.add("btn-secondary");
              } else if (triggerBtn.classList.contains("copy-password-btn")) {
                triggerBtn.classList.add("btn-warning");
              } else {
                triggerBtn.classList.add("btn-primary");
              }
            }
          } catch (err) {
            // Nếu phần tử đã bị xóa, bỏ qua
          }
        }, 1000);
      } catch (err) {
        // Nếu phần tử đã bị xóa, bỏ qua
      }
      try {
        e && e.clearSelection && e.clearSelection();
      } catch (_) {}
    });
  if (clipboard)
    clipboard.on("error", async function (e) {
      try {
        var triggerBtn = e && e.trigger ? e.trigger : null;
        var text = triggerBtn
          ? triggerBtn.getAttribute("data-clipboard-text") || ""
          : "";
        if (!text) return;
        const applySuccessEffect = (btn) => {
          if (!btn || !btn.classList) return;
          try {
            btn.classList.remove("btn-primary", "btn-secondary", "btn-warning");
            btn.classList.add("btn-success");
            setTimeout(() => {
              try {
                btn.classList.remove("btn-success");
                if (btn.classList.contains("copy-email-btn")) {
                  btn.classList.add("btn-secondary");
                } else if (triggerBtn.classList.contains("copy-password-btn")) {
                  btn.classList.add("btn-warning");
                } else {
                  btn.classList.add("btn-primary");
                }
              } catch (_) {}
            }, 1000);
          } catch (_) {}
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(text);
            applySuccessEffect(triggerBtn);
            return;
          } catch (_) {}
        }
        // Fallback textarea
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          applySuccessEffect(triggerBtn);
        } catch (_) {}
        document.body.removeChild(ta);
      } catch (_) {
        alert("Copy failed");
      }
    });

  // Thêm JS xử lý sự kiện click cho .read-mail-tf-btn
  document
    .getElementById("emailsTableBody")
    .addEventListener("click", async function (e) {
      // Copy code when clicking on the displayed mail code
      const codeSpan = e.target.closest(".mail-code-info");
      if (codeSpan) {
        const text = (codeSpan.textContent || "").trim();
        if (text) {
          const onCopied = () => {
            const originalBg = codeSpan.style.backgroundColor;
            const originalBorder = codeSpan.style.borderColor;
            codeSpan.style.backgroundColor = "#d4edda";
            codeSpan.style.borderColor = "#198754";
            setTimeout(() => {
              codeSpan.style.backgroundColor = originalBg;
              codeSpan.style.borderColor = originalBorder;
            }, 600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              onCopied();
            } catch (_) {}
          } else {
            // Fallback for older browsers
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            onCopied();
          }
        }
        e.stopPropagation();
        return;
      }

      // Copy when clicking on Password cell
      const pwdCell = e.target.closest(".password-tn-cell");
      if (pwdCell) {
        const text = (
          pwdCell.getAttribute("data-password") ||
          pwdCell.textContent ||
          ""
        ).trim();
        if (text) {
          const onCopied = () => {
            const originalBg = pwdCell.style.backgroundColor;
            const originalBorder = pwdCell.style.borderColor;
            pwdCell.style.backgroundColor = "#d4edda";
            pwdCell.style.borderColor = "#198754";
            setTimeout(() => {
              pwdCell.style.backgroundColor = originalBg;
              pwdCell.style.borderColor = originalBorder;
            }, 600);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
              await navigator.clipboard.writeText(text);
              onCopied();
            } catch (_) {}
          } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            onCopied();
          }
        }
        e.stopPropagation();
        return;
      }

      if (e.target.closest(".read-mail-tf-btn")) {
        const btn = e.target.closest(".read-mail-tf-btn");
        const email = btn.getAttribute("data-email");
        const password_email = btn.getAttribute("data-password-email");
        const refreshToken = btn.getAttribute("data-refresh-token");
        const clientId = btn.getAttribute("data-client-id");
        try {
          btn.disabled = true;
          btn.innerHTML =
            '<span class="spinner-border spinner-border-sm"></span>';
          // Gọi API Django đọc mail
          const formData = new FormData();
          formData.append(
            "email_data",
            `${email}|${password_email}|${refreshToken}|${clientId}`,
          );
          const response = await fetch("/api/get-code-tf/", {
            method: "POST",
            body: formData,
          });
          if (response.ok) {
            const data = await response.json();
            const results = data.results;

            if (Array.isArray(results.results) && results.results.length > 0) {
              const validCodes = results.results.filter(
                (r) => r.code && /^\d{6}$/.test(r.code) && r.date,
              );
              validCodes.sort((a, b) => new Date(b.date) - new Date(a.date));
              const codeResult = validCodes[0];
              if (codeResult) {
                saveMailCode(email, "tf", codeResult.code);
                const readMailTd = btn.parentElement;
                const oldCodeSpan = readMailTd.querySelector(".mail-code-info");
                if (oldCodeSpan) oldCodeSpan.remove();
                const codeSpan = document.createElement("span");
                codeSpan.className = "mail-code-info";
                codeSpan.textContent = codeResult.code;
                readMailTd.appendChild(codeSpan);
              }
            } else {
              console.log("DEBUG: Không có data.results hợp lệ", data);
            }
          }
        } catch (err) {
          console.error(
            "An error occurred while calling API to read mail!",
            err,
          );
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-envelope-open-text"></i>';
        }
      } else if (e.target.closest(".read-mail-tn-btn")) {
        const btn = e.target.closest(".read-mail-tn-btn");
        const email = btn.getAttribute("data-email");
        console.log("[TN][CLICK] email=", email);
        const password_email = btn.getAttribute("data-password-email");
        const refreshToken = btn.getAttribute("data-refresh-token");
        const clientId = btn.getAttribute("data-client-id");
        try {
          btn.disabled = true;
          btn.innerHTML =
            '<span class="spinner-border spinner-border-sm"></span>';
          const t0 = performance.now();
          // Gọi API Django đọc mail TN
          const formData = new FormData();
          formData.append(
            "email_data",
            `${email}|${password_email}|${refreshToken}|${clientId}`,
          );
          const response = await fetch("/api/get-code-tn/", {
            method: "POST",
            body: formData,
          });
          const t1 = performance.now();

          if (response.ok) {
            const data = await response.json();
            const results = data.results;
            try {
              const c = Array.isArray(results?.results)
                ? results.results.length
                : 0;
              console.log(
                "[TN][DATA] count=",
                c,
                "error=",
                results?.error || null,
              );
            } catch (_) {}
            if (Array.isArray(results.results) && results.results.length > 0) {
              const validCodes = results.results.filter(
                (r) => r.code && /^\d{6}$/.test(r.code) && r.date,
              );
              validCodes.sort((a, b) => new Date(b.date) - new Date(a.date));
              const codeResult = validCodes[0];
              if (codeResult) {
                // Lưu code vào localStorage
                saveMailCode(email, "tn", codeResult.code);
                // Cập nhật giao diện
                const readMailTd = btn.parentElement;
                const oldCodeSpan = readMailTd.querySelector(".mail-code-info");
                if (oldCodeSpan) oldCodeSpan.remove();
                const codeSpan = document.createElement("span");
                codeSpan.className = "mail-code-info";
                codeSpan.textContent = codeResult.code;
                readMailTd.appendChild(codeSpan);
              }
            } else {
              const errMsg =
                results && results.error
                  ? results.error
                  : "Mail service temporarily unavailable";
              console.warn("[TN][WARN] No results. err=", errMsg);
              // alert('Không thể đọc mail lúc này.\n' + errMsg);
            }
          }
        } catch (err) {
          console.error("[TN][ERR] call api failed", err);
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-envelope-open-text"></i>';
        }
      }
    });

  // ClipboardJS đã xử lý copy cho .copy-btn, .copy-email-btn, .copy-password-btn

  let emailFontSize = 24; // px, mặc định như bạn đang để
  const minFontSize = 12;
  const maxFontSize = 48;

  function updateEmailFontSize() {
    document.querySelectorAll(".table td:nth-child(3)").forEach((td) => {
      td.style.fontSize = emailFontSize + "px";
    });
  }

  // (Đã có listener change cho .status-select ở phía trên cùng emailsTableBody; tránh lặp xử lý)

  // Xử lý sự kiện input cho validation mã vùng
  emailsTableBody.addEventListener("input", function (e) {
    if (e.target.classList.contains("area-phone-input")) {
      validateAreaPhone(e.target);
    }
  });

  // Lưu dữ liệu định kỳ (mỗi 5 phút)
  setInterval(
    function () {
      saveWorksessionToServer();
    },
    5 * 60 * 1000,
  ); // 5 phút

  // Gọi khi trang load
  updateReservedEmailCount();

  // Gọi định kỳ mỗi 120 giây để cập nhật real-time
  setInterval(updateReservedEmailCount, 120000);

  // Chạy cleanup định kỳ code mail mỗi giờ
  setInterval(cleanupOldMailCodes, 60 * 60 * 1000);

  // Chạy cleanup định kỳ email mỗi giờ
  setInterval(cleanupOldEmails, 60 * 60 * 1000); // Mỗi giờ
  // Chạy cleanup định kỳ email GR mỗi giờ
  setInterval(cleanupOldEmailsGR, 60 * 60 * 1000);

  // Gmail Recovery: setup listeners
  const selectAllGR = document.getElementById("selectAllGR");
  const emailsTableBodyGR = document.getElementById("emailsTableBodyGR");
  const regAccBtnGR = document.getElementById("regAccBtnGR");
  const setAreaCodeBtnGR = document.getElementById("setAreaCodeBtnGR");
  if (selectAllGR) {
    selectAllGR.addEventListener("change", function () {
      const checkboxes = document.querySelectorAll(".email-checkbox-gr");
      checkboxes.forEach((cb) => {
        if (!cb.disabled) cb.checked = selectAllGR.checked;
      });
      toggleRegAccButtonGR();
      // sync toolbar button visibility
      const regBtnGR = document.getElementById("regAccBtnGR");
      if (regBtnGR)
        regBtnGR.style.display =
          Array.from(document.querySelectorAll(".email-checkbox-gr:checked"))
            .length > 0
            ? "inline-block"
            : "none";
    });
  }
  if (emailsTableBodyGR) {
    emailsTableBodyGR.addEventListener("change", function (e) {
      if (e.target.classList.contains("email-checkbox-gr")) {
        const checkboxes = document.querySelectorAll(
          ".email-checkbox-gr:not([disabled])",
        );
        const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
        if (selectAllGR) selectAllGR.checked = allChecked;
        toggleRegAccButtonGR();
        const regBtnGR = document.getElementById("regAccBtnGR");
        if (regBtnGR)
          regBtnGR.style.display =
            Array.from(document.querySelectorAll(".email-checkbox-gr:checked"))
              .length > 0
              ? "inline-block"
              : "none";
      }
      if (e.target.classList.contains("status-select-gr")) {
        const email = e.target.dataset.email;
        const type = e.target.dataset.type; // tn|tf
        const newStatus = e.target.value;
        updateStatusInStorageGR(email, type, newStatus, e.target);
        updateSelectStyleForOne(e.target);
        // Update checkbox visibility like Table 1 when status changes
        updateCheckboxVisibilityGR(email);
      }
      if (e.target.classList.contains("area-phone-input-gr")) {
        const email = e.target.dataset.email;
        const newArea = e.target.value;
        updateAreaPhoneInStorageGR(email, newArea);
      }
    });
    emailsTableBodyGR.addEventListener("input", function (e) {
      if (e.target.classList.contains("area-phone-input-gr")) {
        validateAreaPhone(e.target);
      }
    });
    emailsTableBodyGR.addEventListener("click", async function (e) {
      const target =
        e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
      const row = target.closest("tr");
      if (!row) return;

      // Mở overlay phóng to cho email cell GR (single click)
      const emailCellGr = target.closest(".email-cell-gr");
      if (emailCellGr) {
        const overlay = document.getElementById("emailZoomOverlay");
        const textEl = document.getElementById("emailZoomText");
        if (overlay && textEl) {
          textEl.textContent = emailCellGr.textContent.trim();
          overlay.style.display = "block";
          document.body.style.overflow = "hidden";
        }
        return; // Không làm gì khác khi bấm vào email
      }

      // Copy handlers for GR table cells
      const recoveryCell = target.closest(".email-recovery-cell");
      const pwdCell = target.closest(".password-tn-cell");
      const performCopy = async (text, el) => {
        if (!text) return;
        const onCopied = () => {
          const originalBg = el.style.backgroundColor;
          const originalBorder = el.style.borderColor;
          el.style.backgroundColor = "#d4edda";
          el.style.borderColor = "#198754";
          setTimeout(() => {
            el.style.backgroundColor = originalBg;
            el.style.borderColor = originalBorder;
          }, 600);
        };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            onCopied();
          } else {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            onCopied();
          }
        } catch (_) {}
      };
      if (recoveryCell) {
        const text = (recoveryCell.textContent || "").trim();
        await performCopy(text, recoveryCell);
        e.stopPropagation();
        return;
      }
      if (pwdCell) {
        const text = (
          pwdCell.getAttribute("data-password") ||
          pwdCell.textContent ||
          ""
        ).trim();
        await performCopy(text, pwdCell);
        e.stopPropagation();
        return;
      }

      if (target.closest("input, select, button, label, a")) return;
      const checkbox = row.querySelector(".email-checkbox-gr");
      if (checkbox && !checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        toggleRegAccButtonGR();
      }
    });
  }
  if (setAreaCodeBtnGR) {
    setAreaCodeBtnGR.addEventListener("click", function () {
      // Reuse modal; after confirm, apply only to GR empty area codes
      showSetAreaCodeModal();
      // Override confirm handler once for GR
      const originalConfirm = window.confirmSetAreaCode;
      window.confirmSetAreaCode = function () {
        const newAreaCode = document.getElementById("areaCodeInput").value;
        if (!/^\d{1,3}$/.test(newAreaCode || "")) {
          alert(
            "The area code must be a number and have a maximum length of 3 characters!",
          );
          return;
        }
        try {
          const storedData = localStorage.getItem("employee_worksession_gr");
          if (!storedData) {
            originalConfirm();
            return;
          }
          const emails = JSON.parse(storedData) || [];
          let changed = false;
          emails.forEach((e) => {
            const isEmpty = !e.area_phone || String(e.area_phone).trim() === "";
            if (isEmpty) {
              e.area_phone = newAreaCode;
              changed = true;
            }
          });
          if (changed) {
            localStorage.setItem(
              "employee_worksession_gr",
              JSON.stringify(emails),
            );
            document
              .querySelectorAll("#emailsTableBodyGR .area-phone-input-gr")
              .forEach((inp) => {
                if (!inp.value || String(inp.value).trim() === "")
                  inp.value = newAreaCode;
              });
          }
          closeSetAreaCodeModal();
        } catch (err) {
          alert("An error occurred while updating the area code");
        }
        // restore
        window.confirmSetAreaCode = originalConfirm;
      };
    });
  }
  if (regAccBtnGR) {
    regAccBtnGR.addEventListener("click", async function () {
      const checkedBoxes = document.querySelectorAll(
        ".email-checkbox-gr:checked",
      );
      const selected = Array.from(checkedBoxes)
        .map((cb) => {
          const stored = localStorage.getItem("employee_worksession_gr");
          if (!stored) return null;
          const emails = JSON.parse(stored) || [];
          return emails.find((e) => e.email === cb.dataset.email) || null;
        })
        .filter(Boolean);
      if (!selected.length) return;
      // Validate area
      const missingArea = selected.filter(
        (e) => !e.area_phone || String(e.area_phone).trim() === "",
      );
      if (missingArea.length > 0) {
        alert(
          "Please set the phone area code for all selected emails before creating accounts.",
        );
        return;
      }
      try {
        regAccBtnGR.disabled = true;
        regAccBtnGR.innerHTML =
          '<span class="spinner-border spinner-border-sm" role="status"></span>';
        // Ensure pass_TN for GR same logic as Table 1 before sending
        (function applyGeneratedPasswordsGR() {
          try {
            const stored = localStorage.getItem("employee_worksession_gr");
            const emails = stored ? JSON.parse(stored) : [];
            const basePass = (
              document.getElementById("passTnInfo")?.textContent || ""
            )
              .replace(/^TN password:\s*/i, "")
              .trim();
            selected.forEach((sel) => {
              const hasCustom = sel.pass_TN && !/(\d{3}@)$/.test(sel.pass_TN);
              if (
                !hasCustom &&
                basePass &&
                basePass !== "[No data]" &&
                basePass !== "[Error]"
              ) {
                const row = document.querySelector(
                  `#emailsTableBodyGR tr[data-email="${sel.email}"]`,
                );
                let noText = "001";
                if (row) {
                  const noCell = row.querySelector("td:nth-child(2)");
                  if (noCell && noCell.textContent)
                    noText = noCell.textContent.trim();
                }
                const newPass = basePass + noText + "@";
                sel.pass_TN = newPass;
                const idx = emails.findIndex((e) => e.email === sel.email);
                if (idx !== -1) emails[idx].pass_TN = newPass;
              }
            });
            localStorage.setItem(
              "employee_worksession_gr",
              JSON.stringify(emails),
            );
          } catch (_) {}
        })();
        const normalized = selected.map((sel) => {
          const fullInfo =
            sel.full_information && String(sel.full_information).trim()
              ? sel.full_information
              : `${sel.email}|${sel.password_email}|${
                  sel.gmail_recovery || ""
                }`; // email|password|gmail_recovery

          // Đảm bảo date luôn ở format DD-MM-YYYY
          let finalDate = "";
          const rawDate = sel.date || sel.created_at || "";
          if (rawDate) {
            const parsedDate = formatDateDDMMYYYY(rawDate);
            if (parsedDate) {
              finalDate = parsedDate;
            } else {
              // Nếu không parse được, dùng date hiện tại
              finalDate = formatDateDDMMYYYY(new Date());
            }
          } else {
            // Nếu không có date, dùng date hiện tại
            finalDate = formatDateDDMMYYYY(new Date());
          }

          // Lấy status trực tiếp từ DOM để đảm bảo đồng bộ với UI
          const row = document.querySelector(
            '#emailsTableBodyGR tr[data-email="' + sel.email + '"]',
          );
          let statusTN = sel.status_account_TN || "new";
          let statusTF = sel.status_account_TF || "new";
          if (row) {
            const tnSelect = row.querySelector(
              '.status-select-gr[data-type="tn"]',
            );
            const tfSelect = row.querySelector(
              '.status-select-gr[data-type="tf"]',
            );
            if (tnSelect && tnSelect.value) statusTN = tnSelect.value;
            if (tfSelect && tfSelect.value) statusTF = tfSelect.value;
          }

          return {
            email: sel.email,
            password_email: sel.password_email,
            pass_TN: sel.pass_TN || "",
            pass_TF: sel.pass_TF || "",
            status_account_TN: statusTN,
            status_account_TF: statusTF,
            supplier: sel.supplier || "gmail_recovery",
            area_phone: sel.area_phone || "",
            office: sel.office || userOffice || "",
            date: finalDate,
            gmail_recovery: sel.gmail_recovery || "",
            full_information: fullInfo,
          };
        });
        const csrftoken =
          (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || "";
        const resp = await fetch("/api/create-textnow/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
          },
          body: JSON.stringify(normalized),
        });
        const data = await resp.json();
        if (data.success) {
          // Cập nhật localStorage GR: đánh dấu is_reg_acc=true cho các email đã tạo
          try {
            const stored = localStorage.getItem("employee_worksession_gr");
            if (stored) {
              const emails = JSON.parse(stored) || [];
              selected.forEach((sel) => {
                const i = emails.findIndex((e) => e.email === sel.email);
                if (i !== -1) emails[i].is_reg_acc = true;
              });
              localStorage.setItem(
                "employee_worksession_gr",
                JSON.stringify(emails),
              );
            }
          } catch (_) {}
          // Cập nhật DOM: disable checkbox, select và area input, thêm row-disabled
          selected.forEach((sel) => {
            const row = document.querySelector(
              `#emailsTableBodyGR tr[data-email="${sel.email}"]`,
            );
            if (!row) return;
            row.classList.add("row-disabled");
            const cb = row.querySelector(".email-checkbox-gr");
            if (cb) {
              cb.checked = false;
              cb.disabled = true;
            }
            row
              .querySelectorAll(".status-select-gr, .area-phone-input-gr")
              .forEach((el) => {
                el.disabled = true;
              });
          });
          alert("Successfully created account");
        } else {
          alert("An error occurred: " + (data.error || "Unknown"));
        }
      } catch (err) {
        alert("An error occurred while calling API");
      } finally {
        regAccBtnGR.disabled = false;
        regAccBtnGR.innerHTML = "Reg Acc";
      }
    });
  }
});

function closePurchaseModal() {
  document.getElementById("purchaseModal").style.display = "none";
  document.body.style.overflow = "auto";
  currentMailData = null;
}

function closeMailListModal() {
  document.getElementById("mailListModal").style.display = "none";
  document.body.style.overflow = "auto";
}

function closeModal() {
  document.getElementById("passwordModal").style.display = "none";
  document.body.style.overflow = "auto";
}

function closeConfirmFetchModal() {
  document.getElementById("confirmFetchModal").style.display = "none";
  document.body.style.overflow = "auto";
}

// Thêm các hàm xử lý modal set mã vùng
function showSetAreaCodeModal() {
  const modal = document.getElementById("setAreaCodeModal");
  modal.style.display = "block";
  document.getElementById("areaCodeInput").value = "";
  document.getElementById("areaCodeInput").focus();
}

function closeSetAreaCodeModal() {
  const modal = document.getElementById("setAreaCodeModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

function confirmSetAreaCode() {
  const newAreaCode = document.getElementById("areaCodeInput").value;
  if (!newAreaCode) {
    alert("Please enter the area code!");
    return;
  }
  // Validate mã vùng
  if (!/^\d{1,3}$/.test(newAreaCode)) {
    alert(
      "The area code must be a number and have a maximum length of 3 characters!",
    );
    return;
  }
  try {
    // Lấy dữ liệu từ localStorage
    const storedData = localStorage.getItem("employee_worksession");
    if (!storedData) {
      throw new Error("No data found in localStorage");
    }
    // Parse dữ liệu
    const emails = JSON.parse(storedData);
    if (!Array.isArray(emails)) {
      throw new Error("Invalid data");
    }
    // Cập nhật mã vùng chỉ cho những record có mã vùng rỗng
    let changed = false;
    emails.forEach((email) => {
      const isEmptyArea =
        !email.area_phone || String(email.area_phone).trim() === "";
      if (isEmptyArea) {
        email.area_phone = newAreaCode;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem("employee_worksession", JSON.stringify(emails));
      // Tối ưu: chỉ update input trên DOM thay vì render lại bảng
      document.querySelectorAll(".area-phone-input").forEach((input) => {
        if (!input.value || String(input.value).trim() === "") {
          input.value = newAreaCode;
        }
      });
    }
    closeSetAreaCodeModal();
  } catch (error) {
    console.error("An error occurred while updating the area code:", error);
    alert("An error occurred while updating the area code: " + error.message);
  }
}

// Hàm đếm và hiển thị bộ đếm trạng thái TN (trừ 'new', 'error', 'not reg')
function renderStatusTnCounter(emails) {
  const counterSpan = document.getElementById("statusTnCounter");
  if (!counterSpan) return;
  let count = 0;
  emails.forEach((email) => {
    const status = (email.status_account_TN || "").toLowerCase();
    if (
      status !== "new" &&
      status !== "error" &&
      status !== "not reg" &&
      status !== ""
    ) {
      count++;
    }
  });
  counterSpan.innerHTML =
    count > 0
      ? `<span class="badge bg-info ms-1">${count}</span>`
      : '<span class="text-muted ms-1">(0)</span>';
}

// Hàm đếm và hiển thị tổng số lượng trạng thái TF (trừ 'new' và 'error')
function renderStatusTfCounter(emails) {
  const counterSpan = document.getElementById("statusTfCounter");
  if (!counterSpan) return;
  let count = 0;
  emails.forEach((email) => {
    const status = (email.status_account_TF || "").toLowerCase();
    if (
      status !== "new" &&
      status !== "error" &&
      status !== "not reg" &&
      status !== ""
    ) {
      count++;
    }
  });
  counterSpan.innerHTML =
    count > 0
      ? `<span class="badge bg-info ms-1">${count}</span>`
      : '<span class="text-muted ms-1">(0)</span>';
}

// Hàm đếm và hiển thị tổng số lượng trạng thái TT (trừ 'new', 'error', 'not reg')
function renderStatusTtCounter(emails) {
  const counterSpan = document.getElementById("statusTtCounter");
  if (!counterSpan) return;
  let count = 0;
  emails.forEach((email) => {
    const status = (email.status_account_TT || "").toLowerCase();
    if (
      status !== "new" &&
      status !== "error" &&
      status !== "not reg" &&
      status !== ""
    ) {
      count++;
    }
  });
  counterSpan.innerHTML =
    count > 0
      ? `<span class="badge bg-info ms-1">${count}</span>`
      : '<span class="text-muted ms-1">(0)</span>';
}

function formatPhoneNumber(phoneNumber) {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");
  // Format as XXX XXX XXXX
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return phoneNumber; // Return original if format doesn't match
}

// Thêm sự kiện click vào dòng để chọn checkbox (chỉ khi không click vào input, select, button, label, a, hoặc email-cell)
document
  .getElementById("emailsTableBody")
  .addEventListener("click", function (e) {
    // Chuẩn hóa target để hỗ trợ click vào text node
    const target =
      e.target && e.target.nodeType === 3 ? e.target.parentElement : e.target;
    // Mở overlay phóng to cho email cell - TẠM THỜI TẮT
    const emailCell = target.closest(".email-cell");
    if (emailCell) {
      const overlay = document.getElementById("emailZoomOverlay");
      const textEl = document.getElementById("emailZoomText");
      if (overlay && textEl) {
        textEl.textContent = emailCell.textContent.trim();
        overlay.style.display = "block";
        document.body.style.overflow = "hidden";
      }
      return; // Đừng làm toggle checkbox khi bấm vào email
    }

    // Tìm phần tử tr gần nhất
    const row = target.closest("tr");
    if (!row) return;
    // Nếu click vào input, select, button, label, a, .mail-code-info, .password-tn-cell thì bỏ qua
    if (
      target.closest(
        "input, select, button, label, a, .mail-code-info, .password-tn-cell",
      )
    )
      return;
    const checkbox = row.querySelector(".email-checkbox");
    if (checkbox && !checkbox.disabled) {
      checkbox.checked = !checkbox.checked;
      toggleRegAccButton();
    }
  });

// Đóng overlay phóng to email
(function setupEmailZoomOverlay() {
  const overlay = document.getElementById("emailZoomOverlay");
  const closeBtn = document.getElementById("emailZoomCloseBtn");
  if (!overlay) return;

  function closeOverlay() {
    overlay.style.display = "none";
    document.body.style.overflow = "auto";
  }

  overlay.addEventListener("click", function (e) {
    // chỉ đóng khi click ra ngoài dialog
    if (e.target === overlay) closeOverlay();
  });
  if (closeBtn) closeBtn.addEventListener("click", closeOverlay);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.style.display === "block") closeOverlay();
  });
})();

// Thêm hàm để lưu code vào localStorage
function saveMailCode(email, type, code) {
  const storedCodes = JSON.parse(localStorage.getItem("mail_codes") || "{}");
  if (!storedCodes[email]) {
    storedCodes[email] = {};
  }
  // Lưu code kèm timestamp
  storedCodes[email][type] = {
    code: code,
    timestamp: new Date().getTime(), // Lưu thời điểm tạo code
  };
  localStorage.setItem("mail_codes", JSON.stringify(storedCodes));
}

// Thêm hàm để xóa code cũ
function cleanupOldMailCodes() {
  const storedCodes = JSON.parse(localStorage.getItem("mail_codes") || "{}");
  const currentTime = new Date().getTime();
  const oneDayInMs = 24 * 60 * 60 * 1000; // 1 ngày tính bằng milliseconds
  let hasChanges = false;

  // Duyệt qua tất cả email
  Object.keys(storedCodes).forEach((email) => {
    // Duyệt qua các loại code (tn, tf)
    Object.keys(storedCodes[email]).forEach((type) => {
      const codeData = storedCodes[email][type];
      // Kiểm tra nếu code đã tồn tại quá 1 ngày
      if (currentTime - codeData.timestamp > oneDayInMs) {
        delete storedCodes[email][type];
        hasChanges = true;
      }
    });

    // Xóa email nếu không còn code nào
    if (Object.keys(storedCodes[email]).length === 0) {
      delete storedCodes[email];
      hasChanges = true;
    }
  });

  // Chỉ cập nhật localStorage nếu có thay đổi
  if (hasChanges) {
    localStorage.setItem("mail_codes", JSON.stringify(storedCodes));
  }
}

// Thêm hàm để xóa dữ liệu email cũ
function cleanupOldEmails() {
  const storedData = localStorage.getItem("employee_worksession");
  if (!storedData) return;

  try {
    const emails = JSON.parse(storedData);
    const currentTime = new Date().getTime();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000; // 3 ngày tính bằng milliseconds
    let hasChanges = false;

    // Lọc và giữ lại chỉ những email trong 3 ngày gần nhất
    const filteredEmails = emails.filter((email) => {
      let emailDate;

      // Xử lý các định dạng date khác nhau
      const rawDate = email.date || email.date_get || "";
      if (rawDate) {
        if (String(rawDate).includes("T")) {
          // Nếu là ISO string (2025-06-17T12:22:50.021000)
          emailDate = new Date(rawDate).getTime();
        } else {
          // Parse date với formatDateDDMMYYYY để xử lý cả DD/MM/YYYY và d/m/yyyy
          const parsedDate = formatDateDDMMYYYY(rawDate);
          if (parsedDate) {
            // Parse lại từ DD/MM/YYYY để lấy timestamp
            const [day, month, year] = parsedDate.split("/");
            emailDate = new Date(year, month - 1, day).getTime();
          }
        }
      }

      // Nếu không có date hoặc date không hợp lệ, xóa email
      if (!emailDate || isNaN(emailDate)) {
        hasChanges = true;
        return false;
      }

      // Giữ lại email nếu chưa quá 3 ngày
      const isRecent = currentTime - emailDate <= threeDaysInMs;
      if (!isRecent) {
        hasChanges = true;
      }
      return isRecent;
    });

    // Cập nhật localStorage nếu có thay đổi
    if (hasChanges) {
      localStorage.setItem(
        "employee_worksession",
        JSON.stringify(filteredEmails),
      );
      // Chỉ re-render nếu dữ liệu hôm nay thực sự bị ảnh hưởng
      const today = new Date();
      const formattedToday = formatDateDDMMYYYY(today);
      const todayEmails = filteredEmails.filter((email) => {
        const rawDate = email.date || email.date_get || "";
        if (!rawDate) return false;
        const parsedDate = formatDateDDMMYYYY(rawDate);
        return parsedDate === formattedToday;
      });
      const originalTodayCount = emails.filter((email) => {
        const rawDate = email.date || email.date_get || "";
        if (!rawDate) return false;
        const parsedDate = formatDateDDMMYYYY(rawDate);
        return parsedDate === formattedToday;
      }).length;
      if (todayEmails.length !== originalTodayCount) {
        displayEmails(filteredEmails);
      }
      // Đồng bộ với server (chỉ gọi khi hàm đã sẵn sàng)
      if (typeof window.saveWorksessionToServer === "function") {
        window.saveWorksessionToServer();
      }
    }
  } catch (error) {
    console.error("An error occurred while deleting old email data:", error);
  }
}

// Thêm hàm để xóa dữ liệu Gmail Recovery cũ (giữ lại 3 ngày gần nhất)
function cleanupOldEmailsGR() {
  const storedData = localStorage.getItem("employee_worksession_gr");
  if (!storedData) return;

  try {
    const emails = JSON.parse(storedData) || [];
    const currentTime = new Date().getTime();
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
    let hasChanges = false;

    const filteredEmails = emails.filter((email) => {
      let emailDate;
      const raw = email.date || email.date_get || email.created_at || "";
      if (raw) {
        if (String(raw).includes("T")) {
          const d = new Date(raw);
          emailDate = d.getTime();
        } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(raw))) {
          const [day, month, year] = String(raw).split("/");
          emailDate = new Date(year, month - 1, day).getTime();
        }
      }
      if (!emailDate || isNaN(emailDate)) {
        hasChanges = true;
        return false;
      }
      const isRecent = currentTime - emailDate <= threeDaysInMs;
      if (!isRecent) hasChanges = true;
      return isRecent;
    });

    if (hasChanges) {
      localStorage.setItem(
        "employee_worksession_gr",
        JSON.stringify(filteredEmails),
      );
      // Cập nhật giao diện bảng 2 chỉ khi bảng đang hiển thị
      try {
        const grContainer = document.getElementById("gmailRecoveryContainer");
        if (grContainer && grContainer.style.display !== "none") {
          displayEmailsGR(filteredEmails);
        }
      } catch (_) {}
    }
  } catch (error) {
    console.error("An error occurred while deleting old GR email data:", error);
  }
}

// ===== Gmail Recovery data flow =====
async function loadGmailRecoveryEmails() {
  // Prefer localStorage data; merge server-side GR emails as fallback/source of truth
  try {
    const stored = localStorage.getItem("employee_worksession_gr");
    let localEmails = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(localEmails)) localEmails = [];

    // Merge server-injected GR emails (recovers data if localStorage was cleared)
    const serverGrEmails = window.initialEmailsGR || [];
    if (serverGrEmails.length > 0) {
      const mergedSet = new Set(localEmails.map((e) => e.email));
      serverGrEmails.forEach((e) => {
        if (e && e.email && !mergedSet.has(e.email)) {
          localEmails.push(e);
          mergedSet.add(e.email);
        }
      });
      localStorage.setItem(
        "employee_worksession_gr",
        JSON.stringify(localEmails),
      );
    }

    gmailRecoveryEmails = localEmails;
  } catch (_) {
    gmailRecoveryEmails = window.initialEmailsGR
      ? [...window.initialEmailsGR]
      : [];
  }
  displayEmailsGR(gmailRecoveryEmails);
}

function displayEmailsGR(emails) {
  const tbody = document.getElementById("emailsTableBodyGR");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!Array.isArray(emails) || emails.length === 0) {
    tbody.innerHTML =
      '<tr class="no-email-row"><td colspan="9" class="text-center">No available email</td></tr>';
    renderStatusTnCounterGR([]);
    renderStatusTfCounterGR([]);
    return;
  }

  // Lọc chỉ lấy email có date đúng ngày hôm nay và loại bỏ trùng lặp theo email
  const today = new Date();
  const formattedDate = formatDateDDMMYYYY(today); // DD/MM/YYYY
  const filteredEmails = [];
  const emailSet = new Set();

  const frag = document.createDocumentFragment();
  emails.forEach((email) => {
    // Chuyển đổi date sang định dạng DD/MM/YYYY
    let emailDate = "";
    const rawDate = email.date || email.date_get || email.created_at || "";
    if (rawDate) {
      const parsedDate = formatDateDDMMYYYY(rawDate);
      if (parsedDate) {
        emailDate = parsedDate;
      }
    }
    if (emailDate === formattedDate && !emailSet.has(email.email)) {
      filteredEmails.push({ ...email, timestamp: Date.now() });
      emailSet.add(email.email);
    }
  });

  if (filteredEmails.length === 0) {
    tbody.innerHTML =
      '<tr class="no-email-row"><td colspan="9" class="text-center">No available email</td></tr>';
    renderStatusTnCounterGR([]);
    renderStatusTfCounterGR([]);
    return;
  }

  const passTnFromDom = (
    document.getElementById("passTnInfo")?.textContent || ""
  )
    .replace(/^TN password:\s*/i, "")
    .trim();
  let grStorageNeedsUpdate = false;
  let grPassNeedsUpdate = false;
  filteredEmails.forEach((email, index) => {
    const row = document.createElement("tr");
    row.className = "email-row";
    row.setAttribute("data-email", email.email);
    if (email.is_reg_acc) {
      row.classList.add("row-disabled");
    }
    const defaultFormat = /^.+\d{3}@$/;
    const hasCustomPassword =
      email.pass_TN &&
      email.pass_TN !== passTnFromDom &&
      !defaultFormat.test(email.pass_TN);
    let displayPassTn = "";
    if (hasCustomPassword) {
      displayPassTn = email.pass_TN;
    } else if (
      passTnFromDom &&
      passTnFromDom !== "[No data]" &&
      passTnFromDom !== "[Error]"
    ) {
      displayPassTn = passTnFromDom + String(index + 1).padStart(3, "0") + "@";
    }
    // Compose full info for GR: prefer full_information (or legacy full_infomation) for backward compat
    const _grFullInfo = email.full_information || email.full_infomation || "";
    const computedFullInfoGR =
      _grFullInfo && String(_grFullInfo).trim().length > 0
        ? String(_grFullInfo)
        : `${email.email}|${email.password_email}|${email.gmail_recovery || ""}|${email.client_id || ""}`;
    const sanitizedFullInfoGR = String(computedFullInfoGR).replace(/\|+$/, "");
    if (
      !email.full_information ||
      email.full_information !== sanitizedFullInfoGR
    ) {
      email.full_information = sanitizedFullInfoGR;
      grStorageNeedsUpdate = true;
    }
    // Persist calculated pass_TN for GR if not custom
    if (!hasCustomPassword && displayPassTn) {
      if (email.pass_TN !== displayPassTn) {
        email.pass_TN = displayPassTn;
        grPassNeedsUpdate = true;
      }
    }
    // Determine checkbox visibility like Table 1
    const showTNX = email.status_account_TN === "new";
    const showTFX = email.status_account_TF === "new";
    const showCheckbox = !showTNX && !showTFX;
    const defaultOptions = [
      { value: "new", text: "New" },
      { value: "verified", text: "Verified" },
      { value: "success", text: "Success" },
      { value: "error", text: "Error" },
      { value: "other password", text: "Other password" },
      { value: "not reg", text: "Not reg" },
      { value: "resend link", text: "Resend link" },
    ];
    let tnOptionsHtml = "";
    defaultOptions.forEach((opt) => {
      if (
        opt.value === "other password" &&
        email.status_account_TN === "other password"
      ) {
        tnOptionsHtml += `<option value="other password" selected>${
          email.pass_TN || ""
        }</option>`;
      } else {
        tnOptionsHtml += `<option value="${opt.value}"${
          email.status_account_TN === opt.value ? " selected" : ""
        }>${opt.text}</option>`;
      }
    });
    const tfOptions = defaultOptions.filter((opt) => opt.value !== "verified");
    let tfOptionsHtml = "";
    tfOptions.forEach((opt) => {
      if (
        opt.value === "other password" &&
        email.status_account_TF === "other password"
      ) {
        tfOptionsHtml += `<option value="other password" selected>${
          email.pass_TF || ""
        }</option>`;
      } else {
        tfOptionsHtml += `<option value="${opt.value}"${
          email.status_account_TF === opt.value ? " selected" : ""
        }>${opt.text}</option>`;
      }
    });
    // Safe values for HTML and attribute contexts
    const safeEmailGr = escapeHtml(email.email);
    const safeEmailGrAttr = escapeAttr(email.email);
    const safeRecoveryGr = escapeHtml(email.gmail_recovery || "");
    const safePassTnGr = escapeHtml(displayPassTn);
    const safeCopyAllGr = escapeAttr(sanitizedFullInfoGR);
    const safePasswordEmailGrAttr = escapeAttr(email.password_email || "");

    row.innerHTML = `
      <td>${
        showCheckbox
          ? `<input type="checkbox" class="email-checkbox-gr" data-email="${email.email}" ${
              email.is_reg_acc ? "disabled" : ""
            }>`
          : '<span class="status-x">✕</span>'
      }</td>
      <td>${String(index + 1).padStart(3, "0")}</td>
      <td class="email-cell-gr">${safeEmailGr}</td>
      <td class="email-recovery-cell">${safeRecoveryGr}</td>
      <td class="password-tn-cell" data-password="${safePassTnGr}">${safePassTnGr}</td>
      <td>
        <button class="btn btn-sm btn-primary copy-btn" data-clipboard-text="${safeCopyAllGr}" title="Copy all information">
      <i class="fas fa-copy"></i>
        </button>
        <button class="btn btn-sm btn-secondary copy-email-btn" data-clipboard-text="${safeEmailGrAttr}" title="Copy email name">
      <i class="fas fa-at"></i>
        </button>
        <button class="btn btn-sm btn-warning copy-password-btn" data-clipboard-text="${safePasswordEmailGrAttr}" title="Copy email password">
      <i class="fas fa-key"></i>
        </button>
      </td>
      <td class="area-phone-cell">
        <input type="text" class="form-control area-phone-input-gr" value="${escapeAttr(
          email.area_phone || "",
        )}" data-email="${safeEmailGrAttr}" style="width: 80px; text-align: center;" ${
          email.is_reg_acc ? "disabled" : ""
        }>
      </td>
      <td>
        <select class="form-select status-select-gr" data-email="${safeEmailGrAttr}" data-type="tn" ${
          email.is_reg_acc ? "disabled" : ""
        }>${tnOptionsHtml}</select>
      </td>
      <td>
        <select class="form-select status-select-gr" data-email="${safeEmailGrAttr}" data-type="tf" ${
          email.is_reg_acc ? "disabled" : ""
        }>${tfOptionsHtml}</select>
      </td>
    `;
    frag.appendChild(row);
  });
  tbody.appendChild(frag);
  // Persist back computed full_information for GR items if updated
  if (grStorageNeedsUpdate || grPassNeedsUpdate) {
    try {
      const stored = localStorage.getItem("employee_worksession_gr");
      if (stored) {
        const emails = JSON.parse(stored) || [];
        const infoMap = new Map(
          filteredEmails.map((e) => [
            e.email,
            String(e.full_information || "").replace(/\|+$/, ""),
          ]),
        );
        const passMap = new Map(
          filteredEmails.map((e) => [e.email, e.pass_TN]),
        );
        let changed = false;
        emails.forEach((e) => {
          if (infoMap.has(e.email)) {
            const val = infoMap.get(e.email);
            if (e.full_information !== val) {
              e.full_information = val;
              changed = true;
            }
          }
          if (passMap.has(e.email)) {
            const p = passMap.get(e.email);
            if (p && e.pass_TN !== p) {
              e.pass_TN = p;
              changed = true;
            }
          }
        });
        if (changed)
          localStorage.setItem(
            "employee_worksession_gr",
            JSON.stringify(emails),
          );
      }
    } catch (_) {}
  }
  renderStatusTnCounterGR(filteredEmails);
  renderStatusTfCounterGR(filteredEmails);
  // Cập nhật màu sắc cho các dropdown của bảng 2
  updateSelectStyles();
  // Thêm class row-disabled cho các dòng có checkbox bị disable (Bảng 2)
  document.querySelectorAll("#emailsTableBodyGR tr").forEach((row) => {
    const checkbox = row.querySelector(".email-checkbox-gr");
    if (checkbox && checkbox.disabled) {
      row.classList.add("row-disabled");
    } else if (checkbox) {
      row.classList.remove("row-disabled");
    }
  });
}

function updateStatusInStorageGR(email, type, newStatus, selectElement) {
  const stored = localStorage.getItem("employee_worksession_gr");
  if (!stored) return;
  const emails = JSON.parse(stored) || [];
  const idx = emails.findIndex((e) => e.email === email);
  if (idx === -1) return;
  if (type === "tn") emails[idx].status_account_TN = newStatus;
  else if (type === "tf") emails[idx].status_account_TF = newStatus;
  localStorage.setItem("employee_worksession_gr", JSON.stringify(emails));
  if (selectElement) updateSelectStyleForOne(selectElement);
  renderStatusTnCounterGR(emails);
  renderStatusTfCounterGR(emails);
}

function updateAreaPhoneInStorageGR(email, newArea) {
  const stored = localStorage.getItem("employee_worksession_gr");
  if (!stored) return;
  const emails = JSON.parse(stored) || [];
  const idx = emails.findIndex((e) => e.email === email);
  if (idx === -1) return;
  emails[idx].area_phone = newArea;
  localStorage.setItem("employee_worksession_gr", JSON.stringify(emails));
}

function renderStatusTnCounterGR(emails) {
  const counterSpan = document.getElementById("statusTnCounterGR");
  if (!counterSpan) return;
  let count = 0;
  emails.forEach((email) => {
    const status = (email.status_account_TN || "").toLowerCase();
    if (
      status !== "new" &&
      status !== "error" &&
      status !== "not reg" &&
      status !== ""
    ) {
      count++;
    }
  });
  counterSpan.innerHTML =
    count > 0
      ? `<span class="badge bg-info ms-1">${count}</span>`
      : '<span class="text-muted ms-1">(0)</span>';
}
function renderStatusTfCounterGR(emails) {
  const counterSpan = document.getElementById("statusTfCounterGR");
  if (!counterSpan) return;
  let count = 0;
  emails.forEach((email) => {
    const status = (email.status_account_TF || "").toLowerCase();
    if (
      status !== "new" &&
      status !== "error" &&
      status !== "not reg" &&
      status !== ""
    ) {
      count++;
    }
  });
  counterSpan.innerHTML =
    count > 0
      ? `<span class="badge bg-info ms-1">${count}</span>`
      : '<span class="text-muted ms-1">(0)</span>';
}

// Update checkbox/X for GR table based on current statuses in storage
function updateCheckboxVisibilityGR(email) {
  try {
    const row = document.querySelector(
      `#emailsTableBodyGR tr[data-email="${email}"]`,
    );
    if (!row) return;
    const firstCell = row.querySelector("td:first-child");
    if (!firstCell) return;
    const stored = localStorage.getItem("employee_worksession_gr");
    const emails = stored ? JSON.parse(stored) : [];
    const item = Array.isArray(emails)
      ? emails.find((x) => x.email === email)
      : null;
    if (!item) return;
    const showTNX = item.status_account_TN === "new";
    const showTFX = item.status_account_TF === "new";
    const showCheckbox = !showTNX && !showTFX;
    if (item.is_reg_acc) {
      // After Reg Acc, keep checkbox disabled
      firstCell.innerHTML = `<input type="checkbox" class="email-checkbox-gr" data-email="${email}" disabled>`;
      row.classList.add("row-disabled");
      return;
    }
    if (showCheckbox) {
      // ensure checkbox exists and enabled
      firstCell.innerHTML = `<input type="checkbox" class="email-checkbox-gr" data-email="${email}">`;
    } else {
      // show X when TN or TF is 'new'
      firstCell.innerHTML = '<span class="status-x">✕</span>';
    }
  } catch (_) {}
}

// Hàm cập nhật checkbox real-time khi thay đổi trạng thái
function updateCheckboxVisibility(email) {
  const row =
    document.querySelector(`tr[data-email="${email}"]`) ||
    document
      .querySelector(`.email-checkbox[data-email="${email}"]`)
      ?.closest("tr");

  if (!row) return;

  const checkboxCell = row.querySelector("td:first-child");
  if (!checkboxCell) return;

  // Lấy trạng thái hiện tại từ localStorage
  const storedData = localStorage.getItem("employee_worksession");
  if (!storedData) return;

  const emails = JSON.parse(storedData);
  const emailData = emails.find((e) => e.email === email);
  if (!emailData) return;

  // Kiểm tra trạng thái TN, TF (TT status disabled for now)
  const showTNX = emailData.status_account_TN === "new";
  const showTFX = emailData.status_account_TF === "new";
  const showCheckbox = !showTNX && !showTFX;

  // Cập nhật nội dung cell checkbox
  if (showCheckbox) {
    // Hiển thị checkbox nếu chưa có
    if (!checkboxCell.querySelector(".email-checkbox")) {
      checkboxCell.innerHTML = `<input type="checkbox" class="email-checkbox" data-email="${email}" ${
        emailData.is_reg_acc ? "disabled" : ""
      }>`;
    }
  } else {
    // Hiển thị dấu X nếu chưa có
    if (!checkboxCell.querySelector(".status-x")) {
      checkboxCell.innerHTML = '<span class="status-x">✕</span>';
    }
  }

  // Cập nhật class row-disabled
  if (emailData.is_reg_acc) {
    row.classList.add("row-disabled");
  } else {
    row.classList.remove("row-disabled");
  }
}
function copyAllEmails() {
  const selectedCheckboxes = document.querySelectorAll(
    ".email-checkbox:checked",
  );
  if (selectedCheckboxes.length === 0) {
    alert("Please select at least one email to copy");
    return;
  }

  const storedData = localStorage.getItem("employee_worksession");
  if (!storedData) {
    alert("No email data available in localStorage");
    return;
  }

  try {
    const emails = JSON.parse(storedData);
    if (!Array.isArray(emails) || emails.length === 0) {
      alert("No emails available to copy");
      return;
    }

    const selectedEmails = Array.from(selectedCheckboxes)
      .map((checkbox) => {
        const email = checkbox.getAttribute("data-email");
        return emails.find((e) => e.email === email);
      })
      .filter(
        (email) => email && (email.full_information || email.full_infomation),
      );

    if (selectedEmails.length === 0) {
      alert("No full information available for selected emails");
      return;
    }

    const textToCopy = selectedEmails
      .map((email) => email.full_information || email.full_infomation || "")
      .join("\n");

    // Check for Clipboard API support and use fallback if not available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          alert(
            `Copied ${selectedEmails.length} selected email(s) information to clipboard`,
          );
        })
        .catch((err) => {
          console.error("Failed to copy: ", err);
          alert("Failed to copy to clipboard");
        });
    } else {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = textToCopy;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        alert(
          `Copied ${selectedEmails.length} selected email(s) information to clipboard`,
        );
      } catch (err) {
        console.error("Fallback copy failed: ", err);
        alert("Failed to copy to clipboard");
      }
      document.body.removeChild(ta);
    }
  } catch (error) {
    console.error("Error parsing localStorage data:", error);
    alert("Error retrieving email data");
  }
}
// Đảm bảo chỉ sử dụng event delegation cho checkbox
document
  .getElementById("emailsTableBody")
  .addEventListener("change", function (e) {
    if (e.target.classList.contains("email-checkbox")) {
      // Kiểm tra nếu tất cả checkbox không bị disabled đều được chọn
      const checkboxes = document.querySelectorAll(
        ".email-checkbox:not([disabled])",
      );
      const allChecked = Array.from(checkboxes).every(
        (checkbox) => checkbox.checked,
      );
      const selectAllCheckbox = document.getElementById("selectAll");
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked;
      }
      toggleRegAccButton();
    }
  });
document.getElementById("copyAllBtn").addEventListener("click", copyAllEmails);
