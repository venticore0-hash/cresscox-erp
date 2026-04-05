(() => {
  "use strict";

  const API = "/api";
  const LOGIN_PAGE = "/login";

  const meta = {
    dashboard: [
      "Dashboard",
      "Overview of customers, stock, purchasing, sales, invoices, and recent activity.",
    ],
    customers: [
      "Customers",
      "Manage B2C and B2B customers, view linked invoices, and keep customer records organized.",
    ],
    inventory: [
      "Inventory",
      "Track items, sale price, cost price, low stock, item code, and barcode-linked products.",
    ],
    purchasing: [
      "Purchasing",
      "Record purchases, supplier activity, buying cost, sale price, and update stock automatically.",
    ],
    sales: [
      "Reports & Sales",
      "Review daily, weekly, monthly, and yearly sales and profit performance.",
    ],
    invoice: [
  "Sales Invoice",
  "Create sales invoices with editable prices, discount, tax, barcode lookup, and customer auto-create.",
],
    expenses: [
      "Expenses",
      "Track salaries, utilities, taxes, personal, purchasing, and other operating expenses.",
    ],
    cases: [
      "Cases",
      "Track support cases, claims, issue resolution, and linked customers.",
    ],
    opportunities: [
      "Opportunities",
      "Track B2B leads, quotations, stage, expected value, and follow-up progress.",
    ],
    tasks: [
      "Tasks",
      "Track reminders, due dates, priorities, and operational tasks for the team.",
    ],
    returns: [
      "Returns & Refunds",
      "Create return records linked to invoices, customers, and inventory items.",
    ],
    emails: [
      "Emails",
      "Track B2B email communication history and follow-up notes.",
    ],
    barcode: [
      "Barcode Setup",
      "Link barcodes to items so invoice scanning can fill item details automatically.",
    ],
  };

  const BASE_NAV = [
    ["dashboard", "🏠", "Dashboard"],
    ["customers", "👥", "Customers"],
    ["inventory", "📦", "Inventory"],
    ["purchasing", "🛒", "Purchasing"],
    ["sales", "📈", "Reports & Sales"],
    ["invoice", "🧾", "Sales Invoice"],
    ["expenses", "💸", "Expenses"],
    ["cases", "📁", "Cases"],
    ["opportunities", "🎯", "Opportunities"],
    ["tasks", "✅", "Tasks"],
    ["returns", "↩️", "Returns & Refunds"],
    ["emails", "✉️", "Emails"],
    ["barcode", "🏷️", "Barcode Setup"],
  ];

  const SETTINGS_SUMMARY_WIDGETS = [
    ["sales", "Total Sales"],
    ["expenses", "Total Expenses"],
    ["profit", "Total Profit"],
  ];

  let state = null;
  let currentPage = "dashboard";
  let currentInvoiceItems = [];
  let topEventsBound = false;
  let invoiceAutoNo = true;

  function generateSevenDigitInvoiceNoClient() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}
  function $(id) {
    return document.getElementById(id);
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getWorkspaceId() {
    return localStorage.getItem("workspaceId") || "";
  }

  function getStoredUserEmail() {
    return localStorage.getItem("userEmail") || "";
  }

  function getStoredUserName() {
    const fullName =
      localStorage.getItem("userFullName") || localStorage.getItem("fullName") || "";
    if (fullName.trim()) return fullName.trim();
    const email = getStoredUserEmail();
    if (!email) return "My Account";
    const localPart = email.split("@")[0] || "user";
    return localPart
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getUserInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function getUiStorageKey() {
    return `cresscox-ui-${getWorkspaceId() || "guest"}`;
  }

  function getExtraStorageKey() {
    return `cresscox-extra-${getWorkspaceId() || "guest"}`;
  }

  function getSettingsStorageKey() {
    return `cresscox-settings-${getWorkspaceId() || "guest"}`;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function money(value) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(num(value));
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function queryText() {
    return ($("globalSearch")?.value || "").trim().toLowerCase();
  }

  function matches(obj, q) {
    if (!q) return true;
    return Object.values(obj || {})
      .join(" ")
      .toLowerCase()
      .includes(q);
  }

  function dateKey(dateStr) {
    const d = new Date(dateStr || today());
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function weekKey(dateStr) {
    const d = new Date(dateStr || today());
    if (Number.isNaN(d.getTime())) return "";
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function monthKey(dateStr) {
    return String(dateStr || today()).slice(0, 7);
  }

  function yearKey(dateStr) {
    return String(dateStr || today()).slice(0, 4);
  }

  function sum(arr, mapper) {
    return arr.reduce((acc, item) => acc + num(mapper(item)), 0);
  }

  function clearWorkspaceClientState() {
    localStorage.removeItem("token");
    localStorage.removeItem("workspaceId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userFullName");
    localStorage.removeItem("fullName");
  }

  function logout() {
    if (!confirm("Are you sure you want to logout?")) return;
    clearWorkspaceClientState();
    window.location.replace(LOGIN_PAGE);
  }

  if (!getToken() || !getWorkspaceId()) {
    clearWorkspaceClientState();
    window.location.replace(LOGIN_PAGE);
    return;
  }

  async function apiFetch(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const rawText = await response.text();
    let data = {};

    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearWorkspaceClientState();
        window.location.replace(LOGIN_PAGE);
      }
      throw new Error(data.error || data.message || data.raw || `Request failed (${response.status})`);
    }

    return data;
  }

  function defaultSettings() {
    return {
      collapseFormsByDefault: true,
      showDashboardActivity: true,
      enableB2B: true,
      enableBarcode: true,
      summaryMode: "numbers",
      businessMode: "hybrid",
      summaryWidgets: SETTINGS_SUMMARY_WIDGETS.map(([id]) => id),
      visibleNavTabs: BASE_NAV.map(([id]) => id),
      activityModules: [
        "customers",
        "inventory",
        "purchasing",
        "invoice",
        "returns",
        "expenses",
        "tasks",
      ],
      businessName: "CresscoX",
      businessLogo: "",
      invoiceTagline: "Thank you for your business.",
      invoiceCustomFields: ["Reference", "Notes"],
      inventoryCustomFields: ["Brand", "Location"],
      purchasingCustomFields: ["Purchase Ref"],
    };
  }

  function defaultState() {
    
    return {
      company: {
        name: "CresscoX",
        address: "17 Market Street, Berlin",
        phone: "+49 30 000000",
        email: "sales@cresscox.com",
      },
      customers: [],
      inventory: [],
      purchases: [],
      invoices: [],
      showProfitAmounts: false,
      customerEditId: null,
      inventoryEditId: null,
      purchaseEditId: null,
      invoiceEditId: null,
      customerFormOpen: false,
      inventoryFormOpen: false,
      purchaseFormOpen: false,
      selectedSalesView: "monthly",
      selectedSalesPeriod: "",
    };
  }

  function defaultExtraData() {
    return {
      expenses: [],
      calendarReminders: [],
      cases: [],
      opportunities: [],
      tasks: [],
      returns: [],
      emails: [],
      barcodes: [],
      recentActivity: [],
    };
  }

  function normalizeCustomer(row = {}) {
    return {
      id: String(row.id || uid("cus")),
      name: String(row.name || "").trim(),
      phone: String(row.phone || "").trim(),
      email: String(row.email || "").trim(),
      address: String(row.address || "").trim(),
      notes: String(row.notes || "").trim(),
    };
  }

  function normalizeInventoryItem(row = {}) {
    return {
      id: String(row.id || uid("inv")),
      itemCode: String(row.itemCode || row.item_code || "").trim(),
      itemName: String(row.itemName || row.item_name || "").trim(),
      currentStock: num(row.currentStock ?? row.current_stock),
      minimumQty: num(row.minimumQty ?? row.minimum_qty),
      salePrice: num(row.salePrice ?? row.sale_price),
      costPrice: num(row.costPrice ?? row.cost_price),
      customFields: row.customFields || {},
    };
  }

  function normalizePurchase(row = {}) {
    return {
      id: String(row.id || uid("pur")),
      date: String(row.date || row.purchaseDate || row.purchase_date || today()),
      supplier: String(row.supplier || "").trim(),
      itemCode: String(row.itemCode || row.item_code || "").trim(),
      itemName: String(row.itemName || row.item_name || "").trim(),
      quantity: num(row.quantity),
      costPrice: num(row.costPrice ?? row.cost_price),
      salePrice: num(row.salePrice ?? row.sale_price),
      note: String(row.note || "").trim(),
      customFields: row.customFields || {},
    };
  }

  function normalizeInvoiceItem(item = {}) {
    const quantity = num(item.quantity, 1);
    const price = num(item.price, 0);
    const costPrice = num(item.costPrice ?? item.cost_price, 0);
    const lineTotal = item.lineTotal != null ? num(item.lineTotal) : quantity * price;
    const lineProfit = item.lineProfit != null ? num(item.lineProfit) : quantity * (price - costPrice);
    return {
      id: String(item.id || uid("line")),
      itemCode: String(item.itemCode || item.item_code || "").trim(),
      itemName: String(item.itemName || item.item_name || "").trim(),
      barcode: String(item.barcode || "").trim(),
      quantity,
      price,
      costPrice,
      lineTotal,
      lineProfit,
    };
  }

  function normalizeInvoice(row = {}) {
    const items = Array.isArray(row.items) ? row.items.map(normalizeInvoiceItem) : [];
    const subtotal = row.subtotal != null ? num(row.subtotal) : sum(items, (item) => item.lineTotal);
    const discount = num(row.discount);
    const tax = num(row.tax);
    const total = row.total != null ? num(row.total) : subtotal - discount + tax;
    const profit = row.profit != null ? num(row.profit) : sum(items, (item) => item.lineProfit);

    return {
      id: String(row.id || uid("bill")),
      invoiceNo: String(row.invoiceNo || row.invoice_no || "").trim(),
      date: String(row.date || row.invoiceDate || row.invoice_date || today()),
      customerName: String(row.customerName || row.customer_name || "").trim(),
      customerPhone: String(row.customerPhone || row.customer_phone || "").trim(),
      customerAddress: String(row.customerAddress || row.customer_address || "").trim(),
      items,
      subtotal,
      discount,
      tax,
      total,
      profit,
      customFields: row.customFields || {},
    };
  }

  function normalizeExtraData(raw = {}) {
    const defaults = defaultExtraData();
    return {
      expenses: Array.isArray(raw.expenses) ? raw.expenses : defaults.expenses,
      calendarReminders: Array.isArray(raw.calendarReminders) ? raw.calendarReminders : defaults.calendarReminders,
      cases: Array.isArray(raw.cases) ? raw.cases : defaults.cases,
      opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : defaults.opportunities,
      tasks: Array.isArray(raw.tasks) ? raw.tasks : defaults.tasks,
      returns: Array.isArray(raw.returns) ? raw.returns : defaults.returns,
      emails: Array.isArray(raw.emails) ? raw.emails : defaults.emails,
      barcodes: Array.isArray(raw.barcodes) ? raw.barcodes : defaults.barcodes,
      recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : defaults.recentActivity,
    };
  }

  function normalizeState(raw = {}) {
    return {
      ...defaultState(),
      ...raw,
      company: {
        ...defaultState().company,
        ...(raw.company || {}),
      },
      customers: Array.isArray(raw.customers) ? raw.customers.map(normalizeCustomer) : [],
      inventory: Array.isArray(raw.inventory) ? raw.inventory.map(normalizeInventoryItem) : [],
      purchases: Array.isArray(raw.purchases) ? raw.purchases.map(normalizePurchase) : [],
      invoices: Array.isArray(raw.invoices) ? raw.invoices.map(normalizeInvoice) : [],
      customerFormOpen: raw.customerFormOpen === true,
      inventoryFormOpen: raw.inventoryFormOpen === true,
      purchaseFormOpen: raw.purchaseFormOpen === true,
      selectedSalesView: raw.selectedSalesView || "monthly",
      selectedSalesPeriod: raw.selectedSalesPeriod || "",
    };
  }

  function getSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(getSettingsStorageKey()) || "null");
      return { ...defaultSettings(), ...(raw || {}) };
    } catch {
      return defaultSettings();
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(getSettingsStorageKey(), JSON.stringify(settings));
  }

  function getExtraData() {
    try {
      const raw = JSON.parse(localStorage.getItem(getExtraStorageKey()) || "null");
      return normalizeExtraData(raw || {});
    } catch {
      return defaultExtraData();
    }
  }

  function saveExtraData(extra) {
    localStorage.setItem(getExtraStorageKey(), JSON.stringify(extra));
  }

  function loadUiState() {
  try {
    const raw = JSON.parse(localStorage.getItem(getUiStorageKey()) || "null");
    if (!raw) return defaultState();
    return normalizeState({
      customerEditId: raw.customerEditId || null,
      inventoryEditId: raw.inventoryEditId || null,
      purchaseEditId: raw.purchaseEditId || null,
      invoiceEditId: raw.invoiceEditId || null,
      customerFormOpen: raw.customerFormOpen === true,
      inventoryFormOpen: raw.inventoryFormOpen === true,
      purchaseFormOpen: raw.purchaseFormOpen === true,
      selectedSalesView: raw.selectedSalesView || "monthly",
      selectedSalesPeriod: raw.selectedSalesPeriod || "",
      showProfitAmounts: raw.showProfitAmounts === true,
    });
  } catch {
    return defaultState();
  }
}

  function saveUiState() {
    localStorage.setItem(
      getUiStorageKey(),
      JSON.stringify({
        customerEditId: state.customerEditId,
        showProfitAmounts: Boolean(state.showProfitAmounts),
        inventoryEditId: state.inventoryEditId,
        purchaseEditId: state.purchaseEditId,
        invoiceEditId: state.invoiceEditId,
        customerFormOpen: state.customerFormOpen,
        inventoryFormOpen: state.inventoryFormOpen,
        purchaseFormOpen: state.purchaseFormOpen,
        selectedSalesView: state.selectedSalesView,
        selectedSalesPeriod: state.selectedSalesPeriod,
      })
    );
  }

  async function loadCustomersFromServer() {
    const rows = await apiFetch(`/workspaces/${getWorkspaceId()}/customers`);
    state.customers = Array.isArray(rows) ? rows.map(normalizeCustomer) : [];
  }

  async function createCustomerOnServer(customer) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/customers`, {
      method: "POST",
      body: customer,
    });
  }

  async function updateCustomerOnServer(customer) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/customers/${customer.id}`, {
      method: "PUT",
      body: customer,
    });
  }

  async function deleteCustomerOnServer(id) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/customers/${id}`, {
      method: "DELETE",
    });
  }

  async function loadInventoryFromServer() {
    const rows = await apiFetch(`/workspaces/${getWorkspaceId()}/inventory`);
    state.inventory = Array.isArray(rows) ? rows.map(normalizeInventoryItem) : [];
  }

  async function createInventoryOnServer(item) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/inventory`, {
      method: "POST",
      body: {
        itemCode: item.itemCode,
        itemName: item.itemName,
        currentStock: item.currentStock,
        minimumQty: item.minimumQty,
        salePrice: item.salePrice,
        costPrice: item.costPrice,
      },
    });
  }

  async function updateInventoryOnServer(item) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/inventory/${item.id}`, {
      method: "PUT",
      body: {
        itemCode: item.itemCode,
        itemName: item.itemName,
        currentStock: item.currentStock,
        minimumQty: item.minimumQty,
        salePrice: item.salePrice,
        costPrice: item.costPrice,
      },
    });
  }

  async function deleteInventoryOnServer(id) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/inventory/${id}`, {
      method: "DELETE",
    });
  }

  async function loadPurchasesFromServer() {
    const rows = await apiFetch(`/workspaces/${getWorkspaceId()}/purchases`);
    state.purchases = Array.isArray(rows) ? rows.map(normalizePurchase) : [];
  }

  async function createPurchaseOnServer(purchase) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/purchases`, {
      method: "POST",
      body: {
        purchaseDate: purchase.date,
        supplier: purchase.supplier,
        itemCode: purchase.itemCode,
        itemName: purchase.itemName,
        quantity: purchase.quantity,
        costPrice: purchase.costPrice,
        note: purchase.note,
      },
    });
  }

  async function updatePurchaseOnServer(purchase) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/purchases/${purchase.id}`, {
      method: "PUT",
      body: {
        purchaseDate: purchase.date,
        supplier: purchase.supplier,
        itemCode: purchase.itemCode,
        itemName: purchase.itemName,
        quantity: purchase.quantity,
        costPrice: purchase.costPrice,
        note: purchase.note,
      },
    });
  }

  async function deletePurchaseOnServer(id) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/purchases/${id}`, {
      method: "DELETE",
    });
  }

  async function loadInvoicesFromServer() {
    const rows = await apiFetch(`/workspaces/${getWorkspaceId()}/invoices`);
    state.invoices = Array.isArray(rows) ? rows.map(normalizeInvoice) : [];
  }

  async function createInvoiceOnServer(invoice) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/invoices`, {
      method: "POST",
      body: {
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.date,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerAddress: invoice.customerAddress,
        items: invoice.items.map((item) => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice,
          lineTotal: item.lineTotal,
          lineProfit: item.lineProfit,
        })),
      },
    });
  }

  async function updateInvoiceOnServer(invoice) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/invoices/${invoice.id}`, {
      method: "PUT",
      body: {
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.date,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerAddress: invoice.customerAddress,
        items: invoice.items.map((item) => ({
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: item.quantity,
          price: item.price,
          costPrice: item.costPrice,
          lineTotal: item.lineTotal,
          lineProfit: item.lineProfit,
        })),
      },
    });
  }

  async function deleteInvoiceOnServer(id) {
    await apiFetch(`/workspaces/${getWorkspaceId()}/invoices/${id}`, {
      method: "DELETE",
    });
  }

  async function loadAllDataFromServer() {
    await Promise.all([
      loadCustomersFromServer(),
      loadInventoryFromServer(),
      loadPurchasesFromServer(),
      loadInvoicesFromServer(),
    ]);
  }

  function addActivity(type, text, page = currentPage) {
    const extra = getExtraData();
    extra.recentActivity.unshift({
      id: uid("act"),
      type,
      text,
      page,
      at: nowIso(),
    });
    extra.recentActivity = extra.recentActivity.slice(0, 50);
    saveExtraData(extra);
  }

  function getExtraItems(key) {
    return getExtraData()[key] || [];
  }

  function setExtraItems(key, value) {
    const extra = getExtraData();
    extra[key] = value;
    saveExtraData(extra);
  }

  function getPurchaseAmount(purchase = {}) {
    return num(purchase.totalAmount, num(purchase.quantity) * num(purchase.costPrice));
  }

  function buildPurchasingExpenseRow(purchase = {}) {
    const purchaseDate = String(purchase.date || purchase.purchaseDate || today());
    const amount = getPurchaseAmount(purchase);
    return {
      id: `auto-expense-${purchase.id}`,
      sourcePurchaseId: String(purchase.id || ""),
      autoGenerated: true,
      locked: true,
      date: purchaseDate,
      category: "Purchasing Expenses",
      title: "Purchasing Expense",
      amount,
      employee: "",
      details: `On ${purchaseDate}, Items were purchased for amount ${money(amount)}.`,
    };
  }

  function syncPurchasingExpenses() {
    const extra = getExtraData();
    const manualExpenses = (extra.expenses || []).filter((row) => !row.autoGenerated || row.source !== "purchasing");
    const linkedExpenses = state.purchases.map((purchase) => ({
      ...buildPurchasingExpenseRow(purchase),
      source: "purchasing",
    }));
    extra.expenses = [...linkedExpenses, ...manualExpenses];
    saveExtraData(extra);
    return extra.expenses;
  }

  function getOrCreateAccountId() {
    const storageKey = `cresscox-account-id-${getWorkspaceId() || "guest"}`;
    const existing = localStorage.getItem(storageKey);
    if (existing && /^\d{10}$/.test(existing)) return existing;

    const seed = `${getWorkspaceId()}|${getStoredUserEmail()}|${getStoredUserName()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 10000000000;
    }
    const accountId = String(Math.abs(hash)).padStart(10, "0").slice(0, 10);
    localStorage.setItem(storageKey, accountId);
    return accountId;
  }

  function populateAccountUI() {
    const userName = getStoredUserName();
    const userEmail = getStoredUserEmail() || "No email available";
    const accountId = getOrCreateAccountId();

    if ($("accountName")) $("accountName").textContent = userName;
    if ($("accountRole")) $("accountRole").textContent = "Administrator";
    if ($("accountAvatar")) $("accountAvatar").textContent = getUserInitials(userName);
    if ($("dropdownUserName")) $("dropdownUserName").textContent = userName;
    if ($("dropdownUserEmail")) $("dropdownUserEmail").textContent = userEmail;
    if ($("settingsUserName")) $("settingsUserName").textContent = userName;
    if ($("settingsUserEmail")) $("settingsUserEmail").textContent = userEmail;
    if ($("settingsWorkspaceId")) $("settingsWorkspaceId").textContent = accountId;
    if ($("settingsAccountRole")) $("settingsAccountRole").textContent = "Administrator";
  }

  function toggleAccountDropdown(forceState) {
    const dropdown = $("accountDropdown");
    const trigger = $("accountMenuBtn");
    if (!dropdown || !trigger) return;
    const nextOpen = typeof forceState === "boolean" ? forceState : dropdown.hidden;
    dropdown.hidden = !nextOpen;
    trigger.setAttribute("aria-expanded", String(nextOpen));
  }

  function showSettingsSection(sectionName) {
    const profileSection = $("profileSettingsSection");
    const settingsSection = $("workspaceInfoSection");
    if (!profileSection || !settingsSection) return;

    if (sectionName === "settings") {
      profileSection.hidden = true;
      settingsSection.hidden = false;
      if ($("settingsModalTitle")) $("settingsModalTitle").textContent = "Settings";
      if ($("settingsModalSubtitle")) $("settingsModalSubtitle").textContent = "Manage dashboard, navigation, and system preferences.";
      renderSettingsControls();
    } else {
      profileSection.hidden = false;
      settingsSection.hidden = true;
      if ($("settingsModalTitle")) $("settingsModalTitle").textContent = "Profile";
      if ($("settingsModalSubtitle")) $("settingsModalSubtitle").textContent = "Review your profile information and account details.";
      populateAccountUI();
    }
  }

  function openSettingsModal(section = "profile") {
    const modal = $("settingsModal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("modal-open");
    populateAccountUI();
    showSettingsSection(section);
  }

  function closeSettingsModal() {
    const modal = $("settingsModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function getFilteredNavData() {
    const settings = getSettings();
    const visible = new Set(settings.visibleNavTabs || []);
    return BASE_NAV.filter(([id]) => visible.has(id)).filter(([id]) => {
      if (["cases", "opportunities", "emails"].includes(id) && !settings.enableB2B) return false;
      if (id === "barcode" && !settings.enableBarcode) return false;
      return true;
    });
  }

  function navCount() {
  return "";
}

  function renderNav() {
    const nav = $("nav");
    if (!nav) return;

    const available = getFilteredNavData();
    if (!available.some(([id]) => id === currentPage)) {
      currentPage = "dashboard";
    }

    nav.innerHTML = available
  .map(([id, icon, label]) => `
    <button type="button" class="${id === currentPage ? "active" : ""}" data-page="${id}">
      <span class="nav-main">
        <span>${escapeHtml(label)}</span>
      </span>
    </button>
  `)
  .join("");

    nav.querySelectorAll("button[data-page]").forEach((button) => {
      button.addEventListener("click", () => switchPage(button.dataset.page));
    });
  }

  function switchPage(page) {
    if (!meta[page]) return;
    currentPage = page;
    saveUiState();
    renderAll();
  }

  function setHeader() {
    if ($("pageTitle")) $("pageTitle").textContent = meta[currentPage][0];
    if ($("pageSubtitle")) $("pageSubtitle").textContent = meta[currentPage][1];
    document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
    $(currentPage)?.classList.add("active");
  }

  function inventoryLookupMap() {
    const map = new Map();
    state.inventory.forEach((item) => {
      if (item.itemCode) map.set(item.itemCode.toLowerCase(), item);
      if (item.itemName) map.set(item.itemName.toLowerCase(), item);
    });
    getExtraItems("barcodes").forEach((row) => {
      if (!row.barcode) return;
      const match = state.inventory.find((item) => String(item.id) === String(row.itemId));
      if (match) map.set(String(row.barcode).toLowerCase(), match);
    });
    return map;
  }

  function findInventoryByLookup(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return null;
    return inventoryLookupMap().get(text) || null;
  }

  function findBarcodeForItem(itemId) {
    return getExtraItems("barcodes").find((row) => String(row.itemId) === String(itemId)) || null;
  }

  function ensureCustomerExistsFromInvoice(invoice) {
    const name = String(invoice.customerName || "").trim();
    if (!name) return Promise.resolve();
    const exists = state.customers.find((customer) => customer.name.toLowerCase() === name.toLowerCase());
    if (exists) return Promise.resolve();
    return createCustomerOnServer({
      name,
      phone: invoice.customerPhone || "",
      email: "",
      address: invoice.customerAddress || "",
      notes: "Auto-created from invoice",
    }).then(() => addActivity("customer", `Customer auto-created from invoice: ${name}`, "customers"));
  }

  function dashboardStats() {
    const expenses = syncPurchasingExpenses();
    return {
      sales: sum(state.invoices, (inv) => inv.total),
      profit: sum(state.invoices, (inv) => inv.profit),
      expenses: sum(expenses, (item) => item.amount),
    };
  }

  function renderSummaryCards() {
  const settings = getSettings();
  const stats = dashboardStats();
  const widgets = (settings.summaryWidgets || []).filter((id) => ["sales", "expenses", "profit"].includes(id));
  const labels = {
    sales: "Total Sales",
    expenses: "Total Expenses",
    profit: "Total Profit",
  };

  return widgets
    .map((id) => {
      const isProfit = id === "profit";
      const showProfit = Boolean(state.showProfitAmounts);
      const displayValue = isProfit && !showProfit ? "••••••" : String(money(stats[id] || 0));

      return `
        <div class="card metric ${isProfit ? "profit-metric-card" : ""}">
          <div class="metric-top">
            <div class="label">${escapeHtml(labels[id] || id)}</div>
            ${
              isProfit
                ? `
                  <button
                    class="metric-visibility-btn"
                    type="button"
                    data-toggle-profit-visibility
                    title="${showProfit ? "Hide profit" : "Show profit"}"
                    aria-label="${showProfit ? "Hide profit" : "Show profit"}"
                  >
                    ${showProfit ? "🙈" : "👁️"}
                  </button>
                `
                : ""
            }
          </div>
          <div class="value ${isProfit && !showProfit ? "value-hidden" : ""}">${escapeHtml(displayValue)}</div>
        </div>
      `;
    })
    .join("");
}

function renderRecentActivity() {
  const settings = getSettings();
  if (!settings.showDashboardActivity) return "";
  const allowed = new Set(settings.activityModules || []);
  const items = getExtraItems("recentActivity")
    .filter((item) => allowed.has(item.page) || allowed.has(item.type))
    .slice(0, 10);

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Recent Activity</h3>
          <p>Customized activity feed from your selected modules.</p>
        </div>
      </div>
      <div class="stack-list">
        ${items.length ? items.map((item) => `
          <div class="mini-card">
            <strong>${escapeHtml(item.text)}</strong>
            <span>${escapeHtml(new Date(item.at).toLocaleString())}</span>
          </div>
        `).join("") : `<div class="empty-state compact"><h4>No recent activity yet</h4><p>Create records to see them here.</p></div>`}
      </div>
    </div>
  `;
}

function calendarDateKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDashboardCalendarState() {
  if (!state.dashboardCalendar) {
    const now = new Date();
    state.dashboardCalendar = {
      year: now.getFullYear(),
      month: now.getMonth(),
      selectedDate: calendarDateKey(now),
    };
  }
  return state.dashboardCalendar;
}

function getCalendarEntriesForDate(dateKey) {
  const reminders = getExtraItems("calendarReminders").filter((row) => String(row.date) === String(dateKey));
  const tasks = getExtraItems("tasks").filter((row) => String(row.dueDate) === String(dateKey));
  return { reminders, tasks };
}

function renderDashboardCalendar() {
  const cal = getDashboardCalendarState();
  const year = cal.year;
  const month = cal.month;
  const selectedDate = cal.selectedDate;

  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = firstDay.toLocaleString(undefined, { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push(`<button class="calendar-day muted" type="button" disabled></button>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const { reminders, tasks } = getCalendarEntriesForDate(dateKey);
    const hasItems = reminders.length || tasks.length;
    const isSelected = String(selectedDate) === String(dateKey);

    cells.push(`
      <button
        class="calendar-day ${isSelected ? "active" : ""}"
        type="button"
        data-calendar-date="${dateKey}"
      >
        <span>${day}</span>
        ${hasItems ? `<small>${reminders.length + tasks.length}</small>` : ""}
      </button>
    `);
  }

  const selectedEntries = getCalendarEntriesForDate(selectedDate);

  return `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Calendar & Reminders</h3>
          <p>Create personal reminders and also view tasks by due date.</p>
        </div>
      </div>

      <div class="calendar-toolbar">
        <button class="btn" type="button" id="calendarPrevMonthBtn">←</button>
        <strong>${escapeHtml(monthLabel)}</strong>
        <button class="btn" type="button" id="calendarNextMonthBtn">→</button>
      </div>

      <div class="calendar-weekdays">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>

      <div class="calendar-grid">
        ${cells.join("")}
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div>
            <h3>${escapeHtml(selectedDate)}</h3>
            <p>Add a personal reminder for the selected day.</p>
          </div>
        </div>

        <form id="calendarReminderForm" class="form-grid">
          <input type="hidden" id="calendarReminderDate" value="${escapeHtml(selectedDate)}" />
          <div class="field span-2">
            <label>Reminder</label>
            <input id="calendarReminderTitle" placeholder="Call supplier, pay bill, personal reminder..." required />
          </div>
          <div class="field">
            <label>Time</label>
            <input id="calendarReminderTime" type="time" />
          </div>
          <div class="toolbar-actions" style="grid-column:1/-1;">
            <button class="btn primary" type="submit">Save Reminder</button>
          </div>
        </form>

        <div class="stack-list" style="margin-top:16px;">
          ${selectedEntries.reminders.length || selectedEntries.tasks.length ? `
            ${selectedEntries.reminders.map((row) => `
              <div class="mini-card">
                <strong>Reminder: ${escapeHtml(row.title)}</strong>
                <span>${escapeHtml(row.time || "No time")}</span>
                <button class="btn danger" type="button" data-calendar-reminder-delete="${escapeHtml(row.id)}">Delete</button>
              </div>
            `).join("")}
            ${selectedEntries.tasks.map((row) => `
              <div class="mini-card">
                <strong>Task: ${escapeHtml(row.title)}</strong>
                <span>${escapeHtml(row.priority || "No priority")} • ${escapeHtml(row.done ? "Done" : "Open")}</span>
              </div>
            `).join("")}
          ` : `<div class="empty-state compact"><h4>No reminders or tasks</h4><p>Select a date and add a reminder, or create tasks in the Tasks tab.</p></div>`}
        </div>
      </div>
    </div>
  `;
}

function bindDashboardCalendarEvents() {
  $("calendarPrevMonthBtn")?.addEventListener("click", () => {
    const cal = getDashboardCalendarState();
    let nextMonth = cal.month - 1;
    let nextYear = cal.year;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    }
    state.dashboardCalendar = {
      ...cal,
      month: nextMonth,
      year: nextYear,
      selectedDate: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`,
    };
    renderDashboard();
  });

  $("calendarNextMonthBtn")?.addEventListener("click", () => {
    const cal = getDashboardCalendarState();
    let nextMonth = cal.month + 1;
    let nextYear = cal.year;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    state.dashboardCalendar = {
      ...cal,
      month: nextMonth,
      year: nextYear,
      selectedDate: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`,
    };
    renderDashboard();
  });

  document.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => {
      const cal = getDashboardCalendarState();
      state.dashboardCalendar = {
        ...cal,
        selectedDate: button.dataset.calendarDate,
      };
      renderDashboard();
    });
  });

  $("calendarReminderForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const rows = getExtraItems("calendarReminders");
    const next = {
      id: uid("rem"),
      date: $("calendarReminderDate")?.value || calendarDateKey(),
      title: $("calendarReminderTitle")?.value || "",
      time: $("calendarReminderTime")?.value || "",
    };
    setExtraItems("calendarReminders", [next, ...rows]);
    addActivity("dashboard", `Reminder created: ${next.title}`, "dashboard");
    renderDashboard();
  });

  document.querySelectorAll("[data-calendar-reminder-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      const rows = getExtraItems("calendarReminders");
      setExtraItems("calendarReminders", rows.filter((row) => String(row.id) !== String(button.dataset.calendarReminderDelete)));
      addActivity("dashboard", "Reminder deleted", "dashboard");
      renderDashboard();
    });
  });
}
function bindDashboardProfitToggle() {
  document.querySelectorAll("[data-toggle-profit-visibility]").forEach((button) => {
    button.addEventListener("click", () => {
      state.showProfitAmounts = !Boolean(state.showProfitAmounts);
      saveUiState();
      renderDashboard();
    });
  });
}
  function renderDashboard() {
  $("dashboard").innerHTML = `
    <div class="section-banner">
      <strong>Welcome to CresscoX ERP.</strong>
      Your dashboard now focuses only on total sales, total expenses, total profit, calendar, and recent activity.
    </div>

    <div class="grid cols-3">${renderSummaryCards()}</div>

    <div class="grid cols-2" style="margin-top:18px;">
      ${renderDashboardCalendar()}
      ${renderRecentActivity() || `<div class="card"><div class="empty-state compact"><h4>Activity feed disabled</h4><p>Enable dashboard activity in settings to view latest actions.</p></div></div>`}
    </div>
  `;

  bindDashboardCalendarEvents();
  bindDashboardProfitToggle();
}

function customerHasInvoices(customerName) {
  return state.invoices.some(
    (invoice) =>
      String(invoice.customerName || "").trim().toLowerCase() ===
      String(customerName || "").trim().toLowerCase()
  );
}

function renderCustomers() {
  const q = queryText();
  const filtered = state.customers.filter((row) => matches(row, q));
  const formOpen = state.customerFormOpen;
  const editing = state.customers.find(
    (row) => String(row.id) === String(state.customerEditId)
  );

  $("customers").innerHTML = `
    <div class="section-banner">
      <strong>Customer records:</strong> B2C and B2B customer storage with auto-created customers from invoices and invoice history visibility.
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Customer Form</h3>
          <p>By default the form stays collapsed for a cleaner workflow.</p>
        </div>
        <button class="btn" id="toggleCustomerFormBtn" type="button">${formOpen ? "Collapse" : "Open Form"}</button>
      </div>
      ${formOpen ? `
        <form id="customerForm" class="form-grid">
          <input type="hidden" id="customerId" value="${escapeHtml(editing?.id || "")}" />
          <div class="field"><label>Name</label><input id="customerName" required value="${escapeHtml(editing?.name || "")}" /></div>
          <div class="field"><label>Phone</label><input id="customerPhone" value="${escapeHtml(editing?.phone || "")}" /></div>
          <div class="field"><label>Email</label><input id="customerEmail" type="email" value="${escapeHtml(editing?.email || "")}" /></div>
          <div class="field"><label>Address</label><input id="customerAddress" value="${escapeHtml(editing?.address || "")}" /></div>
          <div class="field" style="grid-column:1/-1;"><label>Notes</label><textarea id="customerNotes" rows="3">${escapeHtml(editing?.notes || "")}</textarea></div>
          <div class="toolbar-actions" style="grid-column:1/-1;">
            <button class="btn primary" type="submit">${editing ? "Update Customer" : "Save Customer"}</button>
            ${editing ? `<button class="btn" type="button" id="cancelCustomerEditBtn">Cancel</button>` : ""}
          </div>
        </form>
      ` : ""}
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="card-header">
        <div>
          <h3>Customer List</h3>
          <p>Select multiple records to delete or export.</p>
        </div>
        <div class="toolbar-actions">
          <span class="mini-card"><strong>Total Customers</strong><span>${filtered.length}</span></span>
          <button class="btn danger" type="button" id="deleteSelectedCustomersBtn">Delete Selected</button>
          <button class="btn" type="button" id="exportSelectedCustomersBtn">Export Selected</button>
        </div>
      </div>
      ${filtered.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" id="selectAllCustomers" /></th>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map((row) => `
                <tr>
                  <td><input type="checkbox" class="customer-row-check" value="${escapeHtml(row.id)}" /></td>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(row.phone)}</td>
                  <td>${escapeHtml(row.email)}</td>
                  <td>${escapeHtml(row.address)}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn" data-customer-edit="${escapeHtml(row.id)}">Edit</button>
                      <button class="btn danger" data-customer-delete="${escapeHtml(row.id)}">Delete</button>
                      ${customerHasInvoices(row.name) ? `<button class="btn" data-customer-show-invoices="${escapeHtml(row.name)}">Show Invoices</button>` : ""}
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state"><h4>No customers found</h4><p>Add your first customer or clear the search.</p></div>`}
    </div>
  `;

  $("toggleCustomerFormBtn")?.addEventListener("click", () => {
    state.customerFormOpen = !state.customerFormOpen;
    saveUiState();
    renderCustomers();
  });

  $("customerForm")?.addEventListener("submit", saveCustomer);

  $("cancelCustomerEditBtn")?.addEventListener("click", () => {
    state.customerEditId = null;
    state.customerFormOpen = false;
    saveUiState();
    renderCustomers();
  });

  $("selectAllCustomers")?.addEventListener("change", (event) => {
    document.querySelectorAll(".customer-row-check").forEach((box) => {
      box.checked = event.target.checked;
    });
  });

  document.querySelectorAll("[data-customer-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.customerEditId = button.dataset.customerEdit;
      state.customerFormOpen = true;
      saveUiState();
      renderCustomers();
    });
  });

  document.querySelectorAll("[data-customer-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCustomers([button.dataset.customerDelete]));
  });

  document.querySelectorAll("[data-customer-show-invoices]").forEach((button) => {
    button.addEventListener("click", () => {
      $("globalSearch").value = button.dataset.customerShowInvoices;
      switchPage("sales");
    });
  });

  $("deleteSelectedCustomersBtn")?.addEventListener("click", () => {
    const ids = [...document.querySelectorAll(".customer-row-check:checked")].map((box) => box.value);
    deleteCustomers(ids);
  });

  $("exportSelectedCustomersBtn")?.addEventListener("click", () => {
    const ids = [...document.querySelectorAll(".customer-row-check:checked")].map((box) => box.value);
    const rows = filtered.filter((row) => ids.includes(String(row.id)));
    if (!rows.length) return alert("Select customer rows first.");
    downloadJson(rows, "customers-selected.json");
  });

  bindSelectionCounter({
    rowSelector: ".customer-row-check",
    selectAllId: "selectAllCustomers",
    deleteBtnId: "deleteSelectedCustomersBtn",
    exportBtnId: "exportSelectedCustomersBtn",
    deleteBaseText: "Delete Selected",
    exportBaseText: "Export Selected",
  });
}
  async function saveCustomer(event) {
    event.preventDefault();
    const customer = normalizeCustomer({
      id: $("customerId")?.value || uid("cus"),
      name: $("customerName")?.value,
      phone: $("customerPhone")?.value,
      email: $("customerEmail")?.value,
      address: $("customerAddress")?.value,
      notes: $("customerNotes")?.value,
    });

    if (!customer.name) return alert("Customer name is required.");

    try {
      if (state.customerEditId) {
        await updateCustomerOnServer(customer);
        addActivity("customers", `Customer updated: ${customer.name}`, "customers");
      } else {
        await createCustomerOnServer(customer);
        addActivity("customers", `Customer created: ${customer.name}`, "customers");
      }
      state.customerEditId = null;
      state.customerFormOpen = getSettings().collapseFormsByDefault ? false : true;
      saveUiState();
      await loadCustomersFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to save customer.");
    }
  }

  async function deleteCustomers(ids) {
    if (!ids.length) return alert("Select at least one customer.");
    if (!confirm(`Delete ${ids.length} customer record(s)?`)) return;
    try {
      for (const id of ids) await deleteCustomerOnServer(id);
      addActivity("customers", `${ids.length} customer record(s) deleted`, "customers");
      await loadCustomersFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to delete customer(s).");
    }
  }

  function renderInventory() {
    const q = queryText();
    const filtered = state.inventory.filter((row) => matches(row, q));
    const editing = state.inventory.find((row) => String(row.id) === String(state.inventoryEditId));
    const formOpen = state.inventoryFormOpen;
    const barcodeCount = getExtraItems("barcodes").length;

    $("inventory").innerHTML = `
      <div class="section-banner">
        <strong>Inventory records:</strong> lookup by item code, item name, or barcode and keep editable sale prices available for invoicing.
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Inventory Form</h3>
              <p>Collapsed by default and ready for customizable fields later.</p>
            </div>
            <button class="btn" id="toggleInventoryFormBtn" type="button">${formOpen ? "Collapse" : "Open Form"}</button>
          </div>
          ${formOpen ? `
            <form id="inventoryForm" class="form-grid">
              <input type="hidden" id="inventoryId" value="${escapeHtml(editing?.id || "")}" />
              <div class="field"><label>Item Code</label><input id="inventoryItemCode" required value="${escapeHtml(editing?.itemCode || "")}" /></div>
              <div class="field"><label>Item Name</label><input id="inventoryItemName" required value="${escapeHtml(editing?.itemName || "")}" /></div>
              <div class="field"><label>Current Stock</label><input id="inventoryCurrentStock" type="number" min="0" value="${escapeHtml(String(editing?.currentStock ?? 0))}" /></div>
              <div class="field"><label>Minimum Qty</label><input id="inventoryMinimumQty" type="number" min="0" value="${escapeHtml(String(editing?.minimumQty ?? 0))}" /></div>
              <div class="field"><label>Sale Price</label><input id="inventorySalePrice" type="number" step="0.01" min="0" value="${escapeHtml(String(editing?.salePrice ?? 0))}" /></div>
              <div class="field"><label>Cost Price</label><input id="inventoryCostPrice" type="number" step="0.01" min="0" value="${escapeHtml(String(editing?.costPrice ?? 0))}" /></div>
              <div class="toolbar-actions" style="grid-column:1/-1;">
                <button class="btn primary" type="submit">${editing ? "Update Item" : "Save Item"}</button>
                ${editing ? `<button class="btn" type="button" id="cancelInventoryEditBtn">Cancel</button>` : ""}
              </div>
            </form>
          ` : ""}
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Barcode Coverage</h3>
              <p>Linked barcodes currently available for invoice scanning.</p>
            </div>
          </div>
          <div class="stack-list">
            <div class="mini-card"><strong>Items</strong><span>${escapeHtml(String(state.inventory.length))}</span></div>
            <div class="mini-card"><strong>Linked Barcodes</strong><span>${escapeHtml(String(barcodeCount))}</span></div>
            <div class="mini-card"><strong>Low Stock Items</strong><span>${escapeHtml(String(state.inventory.filter((item) => item.currentStock <= item.minimumQty).length))}</span></div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-header">
          <div>
            <h3>Inventory List</h3>
            <p>Select rows to delete or export.</p>
          </div>
          <div class="toolbar-actions">
  <span class="mini-card"><strong>Total Items</strong><span>${filtered.length}</span></span>
  <button class="btn danger" type="button" id="deleteSelectedInventoryBtn">Delete Selected</button>
  <button class="btn" type="button" id="exportSelectedInventoryBtn">Export Selected</button>
</div>
        </div>
        ${filtered.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" id="selectAllInventory" /></th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Stock</th>
                  <th>Min</th>
                  <th>Sale</th>
                  <th>Cost</th>
                  <th>Barcode</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((row) => {
                  const barcode = findBarcodeForItem(row.id)?.barcode || "";
                  return `
                    <tr>
                      <td><input type="checkbox" class="inventory-row-check" value="${escapeHtml(row.id)}" /></td>
                      <td>${escapeHtml(row.itemCode)}</td>
                      <td>${escapeHtml(row.itemName)}</td>
                      <td>${escapeHtml(String(row.currentStock))}</td>
                      <td>${escapeHtml(String(row.minimumQty))}</td>
                      <td>${escapeHtml(money(row.salePrice))}</td>
                      <td>${escapeHtml(money(row.costPrice))}</td>
                      <td>${escapeHtml(barcode || "-")}</td>
                      <td>
                        <div class="table-actions">
                          <button class="btn" data-inventory-edit="${escapeHtml(row.id)}">Edit</button>
                          <button class="btn danger" data-inventory-delete="${escapeHtml(row.id)}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h4>No inventory items found</h4><p>Add your first item or clear the search.</p></div>`}
      </div>
    `;

    $("toggleInventoryFormBtn")?.addEventListener("click", () => {
      state.inventoryFormOpen = !state.inventoryFormOpen;
      saveUiState();
      renderInventory();
    });
    $("inventoryForm")?.addEventListener("submit", saveInventoryItem);
    $("cancelInventoryEditBtn")?.addEventListener("click", () => {
      state.inventoryEditId = null;
      state.inventoryFormOpen = false;
      saveUiState();
      renderInventory();
    });
    $("selectAllInventory")?.addEventListener("change", (event) => {
      document.querySelectorAll(".inventory-row-check").forEach((box) => { box.checked = event.target.checked; });
    });
    document.querySelectorAll("[data-inventory-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        state.inventoryEditId = button.dataset.inventoryEdit;
        state.inventoryFormOpen = true;
        saveUiState();
        renderInventory();
      });
    });
    document.querySelectorAll("[data-inventory-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteInventoryItems([button.dataset.inventoryDelete]));
    });
    $("deleteSelectedInventoryBtn")?.addEventListener("click", () => {
      const ids = [...document.querySelectorAll(".inventory-row-check:checked")].map((box) => box.value);
      deleteInventoryItems(ids);
    });
    $("exportSelectedInventoryBtn")?.addEventListener("click", () => {
      const ids = [...document.querySelectorAll(".inventory-row-check:checked")].map((box) => box.value);
      const rows = filtered.filter((row) => ids.includes(String(row.id)));
      if (!rows.length) return alert("Select inventory rows first.");
      downloadJson(rows, "inventory-selected.json");
    });
  bindSelectionCounter({
  rowSelector: ".inventory-row-check",
  selectAllId: "selectAllInventory",
  deleteBtnId: "deleteSelectedInventoryBtn",
  exportBtnId: "exportSelectedInventoryBtn",
  deleteBaseText: "Delete Selected",
  exportBaseText: "Export Selected",
});
  }

  async function saveInventoryItem(event) {
    event.preventDefault();
    const item = normalizeInventoryItem({
      id: $("inventoryId")?.value || uid("inv"),
      itemCode: $("inventoryItemCode")?.value,
      itemName: $("inventoryItemName")?.value,
      currentStock: $("inventoryCurrentStock")?.value,
      minimumQty: $("inventoryMinimumQty")?.value,
      salePrice: $("inventorySalePrice")?.value,
      costPrice: $("inventoryCostPrice")?.value,
    });

    if (!item.itemCode || !item.itemName) return alert("Item code and item name are required.");

    try {
      if (state.inventoryEditId) {
        await updateInventoryOnServer(item);
        addActivity("inventory", `Inventory item updated: ${item.itemCode}`, "inventory");
      } else {
        await createInventoryOnServer(item);
        addActivity("inventory", `Inventory item created: ${item.itemCode}`, "inventory");
      }
      state.inventoryEditId = null;
      state.inventoryFormOpen = getSettings().collapseFormsByDefault ? false : true;
      saveUiState();
      await loadInventoryFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to save inventory item.");
    }
  }

  async function deleteInventoryItems(ids) {
    if (!ids.length) return alert("Select at least one inventory item.");
    if (!confirm(`Delete ${ids.length} inventory item(s)?`)) return;
    try {
      for (const id of ids) await deleteInventoryOnServer(id);
      addActivity("inventory", `${ids.length} inventory item(s) deleted`, "inventory");
      await loadInventoryFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to delete inventory item(s).");
    }
  }

  function purchaseLookupFill() {
    const lookup = $("purchaseLookup")?.value || "";
    const item = findInventoryByLookup(lookup);
    if (!item) return;
    if ($("purchaseItemCode")) $("purchaseItemCode").value = item.itemCode;
    if ($("purchaseItemName")) $("purchaseItemName").value = item.itemName;
    if ($("purchaseSalePrice")) $("purchaseSalePrice").value = String(item.salePrice);
    if ($("purchaseCostPrice") && !$("purchaseCostPrice").value) $("purchaseCostPrice").value = String(item.costPrice);
  }

  function renderPurchasing() {
    const q = queryText();
    const filtered = state.purchases.filter((row) => matches(row, q));
    const editing = state.purchases.find((row) => String(row.id) === String(state.purchaseEditId));
    const formOpen = state.purchaseFormOpen;

    $("purchasing").innerHTML = `
      <div class="section-banner">
        <strong>Purchasing records:</strong> lookup by item code or name, keep sale price reference, and let stock recalculate automatically.
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Purchasing Form</h3>
            <p>Default collapsed layout for faster everyday workflow.</p>
          </div>
          <button class="btn" id="togglePurchaseFormBtn" type="button">${formOpen ? "Collapse" : "Open Form"}</button>
        </div>
        ${formOpen ? `
          <form id="purchaseForm" class="form-grid">
            <input type="hidden" id="purchaseId" value="${escapeHtml(editing?.id || "")}" />
            <div class="field"><label>Date</label><input id="purchaseDate" type="date" value="${escapeHtml(editing?.date || today())}" /></div>
            <div class="field"><label>Supplier</label><input id="purchaseSupplier" value="${escapeHtml(editing?.supplier || "")}" /></div>
            <div class="field span-2"><label>Lookup by item code or name</label><input id="purchaseLookup" placeholder="Type item code or item name" value="" /></div>
            <div class="field"><label>Item Code</label><input id="purchaseItemCode" required value="${escapeHtml(editing?.itemCode || "")}" /></div>
            <div class="field"><label>Item Name</label><input id="purchaseItemName" required value="${escapeHtml(editing?.itemName || "")}" /></div>
            <div class="field"><label>Quantity</label><input id="purchaseQuantity" type="number" min="1" value="${escapeHtml(String(editing?.quantity ?? 1))}" /></div>
            <div class="field"><label>Cost Price</label><input id="purchaseCostPrice" type="number" min="0" step="0.01" value="${escapeHtml(String(editing?.costPrice ?? 0))}" /></div>
            <div class="field"><label>Sale Price</label><input id="purchaseSalePrice" type="number" min="0" step="0.01" value="${escapeHtml(String(editing?.salePrice ?? 0))}" /></div>
            <div class="field span-2"><label>Note</label><textarea id="purchaseNote" rows="3">${escapeHtml(editing?.note || "")}</textarea></div>
            <div class="toolbar-actions" style="grid-column:1/-1;">
              <button class="btn primary" type="submit">${editing ? "Update Purchase" : "Save Purchase"}</button>
              ${editing ? `<button class="btn" type="button" id="cancelPurchaseEditBtn">Cancel</button>` : ""}
            </div>
          </form>
        ` : ""}
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-header">
          <div>
            <h3>Purchase List</h3>
            <p>Select rows to delete or export.</p>
          </div>
          <div class="toolbar-actions">
            <button class="btn danger" type="button" id="deleteSelectedPurchasesBtn">Delete Selected</button>
            <button class="btn" type="button" id="exportSelectedPurchasesBtn">Export Selected</button>
          </div>
        </div>
        ${filtered.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" id="selectAllPurchases" /></th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>Sale</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map((row) => `
                  <tr>
                    <td><input type="checkbox" class="purchase-row-check" value="${escapeHtml(row.id)}" /></td>
                    <td>${escapeHtml(row.date)}</td>
                    <td>${escapeHtml(row.supplier)}</td>
                    <td>${escapeHtml(`${row.itemCode} - ${row.itemName}`)}</td>
                    <td>${escapeHtml(String(row.quantity))}</td>
                    <td>${escapeHtml(money(row.costPrice))}</td>
                    <td>${escapeHtml(money(row.salePrice))}</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn" data-purchase-edit="${escapeHtml(row.id)}">Edit</button>
                        <button class="btn danger" data-purchase-delete="${escapeHtml(row.id)}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state"><h4>No purchases found</h4><p>Add purchase records or clear the search.</p></div>`}
      </div>
    `;

    $("togglePurchaseFormBtn")?.addEventListener("click", () => {
      state.purchaseFormOpen = !state.purchaseFormOpen;
      saveUiState();
      renderPurchasing();
    });
    $("purchaseForm")?.addEventListener("submit", savePurchase);
    $("purchaseLookup")?.addEventListener("input", purchaseLookupFill);
    $("cancelPurchaseEditBtn")?.addEventListener("click", () => {
      state.purchaseEditId = null;
      state.purchaseFormOpen = false;
      saveUiState();
      renderPurchasing();
    });
    $("selectAllPurchases")?.addEventListener("change", (event) => {
      document.querySelectorAll(".purchase-row-check").forEach((box) => { box.checked = event.target.checked; });
    });
    document.querySelectorAll("[data-purchase-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        state.purchaseEditId = button.dataset.purchaseEdit;
        state.purchaseFormOpen = true;
        saveUiState();
        renderPurchasing();
      });
    });
    document.querySelectorAll("[data-purchase-delete]").forEach((button) => {
      button.addEventListener("click", () => deletePurchases([button.dataset.purchaseDelete]));
    });
    $("deleteSelectedPurchasesBtn")?.addEventListener("click", () => {
      const ids = [...document.querySelectorAll(".purchase-row-check:checked")].map((box) => box.value);
      deletePurchases(ids);
    });
    $("exportSelectedPurchasesBtn")?.addEventListener("click", () => {
      const ids = [...document.querySelectorAll(".purchase-row-check:checked")].map((box) => box.value);
      const rows = filtered.filter((row) => ids.includes(String(row.id)));
      if (!rows.length) return alert("Select purchase rows first.");
      downloadJson(rows, "purchases-selected.json");
    });
    bindSelectionCounter({
  rowSelector: ".purchase-row-check",
  selectAllId: "selectAllPurchases",
  deleteBtnId: "deleteSelectedPurchasesBtn",
  exportBtnId: "exportSelectedPurchasesBtn",
  deleteBaseText: "Delete Selected",
  exportBaseText: "Export Selected",
});
  }

  async function savePurchase(event) {
    event.preventDefault();
    const purchase = normalizePurchase({
      id: $("purchaseId")?.value || uid("pur"),
      date: $("purchaseDate")?.value,
      supplier: $("purchaseSupplier")?.value,
      itemCode: $("purchaseItemCode")?.value,
      itemName: $("purchaseItemName")?.value,
      quantity: $("purchaseQuantity")?.value,
      costPrice: $("purchaseCostPrice")?.value,
      salePrice: $("purchaseSalePrice")?.value,
      note: $("purchaseNote")?.value,
    });

    if (!purchase.itemCode || !purchase.itemName) return alert("Item code and item name are required.");

    try {
      if (state.purchaseEditId) {
        await updatePurchaseOnServer(purchase);
        addActivity("purchasing", `Purchase updated: ${purchase.itemCode}`, "purchasing");
      } else {
        await createPurchaseOnServer(purchase);
        addActivity("purchasing", `Purchase created: ${purchase.itemCode}`, "purchasing");
      }
      const matchingItem = state.inventory.find((item) => item.itemCode.toLowerCase() === purchase.itemCode.toLowerCase());
      if (matchingItem && purchase.salePrice) {
        await updateInventoryOnServer({ ...matchingItem, salePrice: purchase.salePrice });
      }
      state.purchaseEditId = null;
      state.purchaseFormOpen = getSettings().collapseFormsByDefault ? false : true;
      saveUiState();
      await loadAllDataFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to save purchase.");
    }
  }

  async function deletePurchases(ids) {
    if (!ids.length) return alert("Select at least one purchase.");
    if (!confirm(`Delete ${ids.length} purchase record(s)?`)) return;
    try {
      for (const id of ids) await deletePurchaseOnServer(id);
      addActivity("purchasing", `${ids.length} purchase record(s) deleted`, "purchasing");
      await loadAllDataFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to delete purchase record(s).");
    }
  }

  function nextInvoiceNumber() {
    const count = state.invoices.length + 1;
    return `INV-${String(count).padStart(5, "0")}`;
  }

  function invoiceItemLookupFill() {
    const lookup = $("invoiceItemLookup")?.value || "";
    const item = findInventoryByLookup(lookup);
    if (!item) return;
    if ($("invoiceItemCode")) $("invoiceItemCode").value = item.itemCode;
    if ($("invoiceItemName")) $("invoiceItemName").value = item.itemName;
    if ($("invoiceItemPrice")) $("invoiceItemPrice").value = String(item.salePrice);
    if ($("invoiceItemCostPrice")) $("invoiceItemCostPrice").value = String(item.costPrice);
    const barcode = findBarcodeForItem(item.id)?.barcode || "";
    if ($("invoiceItemBarcode")) $("invoiceItemBarcode").value = barcode;
  }

  function fillInvoiceCustomerDetails(name) {
    const customer = state.customers.find((row) => row.name.toLowerCase() === String(name || "").trim().toLowerCase());
    if (!customer) return;
    if ($("invoiceCustomerPhone") && !$("invoiceCustomerPhone").value) $("invoiceCustomerPhone").value = customer.phone;
    if ($("invoiceCustomerAddress") && !$("invoiceCustomerAddress").value) $("invoiceCustomerAddress").value = customer.address;
  }

  function renderInvoiceItemsTable() {
    if (!currentInvoiceItems.length) {
      return `<div class="empty-state compact"><h4>No invoice items yet</h4><p>Add item code, item name, or barcode to build the invoice.</p></div>`;
    }

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Name</th>
              <th>Barcode</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${currentInvoiceItems.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(item.itemCode)}</td>
                <td>${escapeHtml(item.itemName)}</td>
                <td>${escapeHtml(item.barcode || "-")}</td>
                <td>${escapeHtml(String(item.quantity))}</td>
                <td>${escapeHtml(money(item.price))}</td>
                <td>${escapeHtml(money(item.lineTotal))}</td>
                <td><button class="btn danger" data-remove-invoice-line="${escapeHtml(item.id)}">Remove</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function collectInvoiceFormFields() {
    const customFieldInputs = document.querySelectorAll("[data-invoice-custom]");
    const customFields = {};
    customFieldInputs.forEach((input) => {
      const key = input.dataset.invoiceCustom;
      if (key) customFields[key] = input.value.trim();
    });

    const subtotal = sum(currentInvoiceItems, (item) => item.lineTotal);
    const discount = num($("invoiceDiscount")?.value, 0);
    const tax = num($("invoiceTax")?.value, 0);
    const total = subtotal - discount + tax;
    const profit = sum(currentInvoiceItems, (item) => item.lineProfit);

    return normalizeInvoice({
      id: $("invoiceRecordId")?.value || uid("bill"),
      invoiceNo: $("invoiceNo")?.value || nextInvoiceNumber(),
      date: $("invoiceDate")?.value || today(),
      customerName: $("invoiceCustomerName")?.value || "",
      customerPhone: $("invoiceCustomerPhone")?.value || "",
      customerAddress: $("invoiceCustomerAddress")?.value || "",
      items: currentInvoiceItems,
      subtotal,
      discount,
      tax,
      total,
      profit,
      customFields,
    });
  }

  function invoiceHtml(invoice, options = {}) {
  const showProfit = Boolean(options.showProfit);
    const settings = getSettings();
    const businessName = settings.businessName || state.company.name || "CresscoX";
    const showPhone = Boolean(String(invoice.customerPhone || "").trim());
    const showAddress = Boolean(String(invoice.customerAddress || "").trim());
    const logoMarkup = settings.businessLogo ? `<img src="${settings.businessLogo}" alt="Business Logo" style="max-height:70px; max-width:180px; object-fit:contain; display:block; margin-bottom:12px;" />` : "";
    const customFields = Object.entries(invoice.customFields || {}).filter(([, value]) => String(value || "").trim());

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(invoice.invoiceNo)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;padding:30px;color:#111} .wrap{max-width:980px;margin:0 auto} table{width:100%;border-collapse:collapse;margin-top:20px} th,td{border:1px solid #ddd;padding:10px;text-align:left} th{background:#f4f4f4} .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px} .muted{color:#666} .totals{margin-left:auto;max-width:320px;margin-top:20px} .totals div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee} .grand{font-weight:700;font-size:1.1rem}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <div>
      ${logoMarkup}
      <h1 style="margin:0 0 8px;">${escapeHtml(businessName)}</h1>
      <div class="muted">${escapeHtml(settings.invoiceTagline || "")}</div>
    </div>
    <div>
      <h2 style="margin:0 0 8px;">Invoice</h2>
      <div><strong>Invoice No:</strong> ${escapeHtml(invoice.invoiceNo)}</div>
      <div><strong>Date:</strong> ${escapeHtml(invoice.date)}</div>
    </div>
  </div>

  <div style="margin-bottom:20px;">
    <div><strong>Customer:</strong> ${escapeHtml(invoice.customerName || "Walk-in Customer")}</div>
    ${showPhone ? `<div><strong>Phone:</strong> ${escapeHtml(invoice.customerPhone)}</div>` : ""}
    ${showAddress ? `<div><strong>Address:</strong> ${escapeHtml(invoice.customerAddress)}</div>` : ""}
    ${customFields.map(([key, value]) => `<div><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</div>`).join("")}
  </div>

  <table>
    <thead><tr><th>Code</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>
      ${invoice.items.map((item) => `<tr><td>${escapeHtml(item.itemCode)}</td><td>${escapeHtml(item.itemName)}</td><td>${escapeHtml(String(item.quantity))}</td><td>${escapeHtml(money(item.price))}</td><td>${escapeHtml(money(item.lineTotal))}</td></tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
  <div><span>Subtotal</span><span>${escapeHtml(money(invoice.subtotal))}</span></div>
  <div><span>Discount</span><span>${escapeHtml(money(invoice.discount))}</span></div>
  <div><span>Tax</span><span>${escapeHtml(money(invoice.tax))}</span></div>
  ${showProfit ? `<div><span>Profit</span><span>${escapeHtml(money(invoice.profit || 0))}</span></div>` : ""}
  <div class="grand"><span>Total</span><span>${escapeHtml(money(invoice.total))}</span></div>
</div>
</div>
</body>
</html>`;
  }

  function previewCurrentInvoice() {
    const invoice = collectInvoiceFormFields();
    if (!invoice.items.length) return alert("Add at least one item before preview.");
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) return;
    previewWindow.document.open();
    previewWindow.document.write(invoiceHtml(invoice));
    previewWindow.document.close();
  }

  function downloadCurrentInvoice() {
    const invoice = collectInvoiceFormFields();
    if (!invoice.items.length) return alert("Add at least one item before download.");
    const blob = new Blob([invoiceHtml(invoice)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNo || "invoice"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printCurrentInvoice() {
    const invoice = collectInvoiceFormFields();
    if (!invoice.items.length) return alert("Add at least one item before print.");
    printInvoiceDocument(invoice, { showProfit: false });
  }

  function removeInvoiceLine(lineId) {
    currentInvoiceItems = currentInvoiceItems.filter((item) => String(item.id) !== String(lineId));
    renderInvoice();
  }

  function addInvoiceLine() {
    const itemCode = $("invoiceItemCode")?.value.trim() || "";
    const itemName = $("invoiceItemName")?.value.trim() || "";
    const barcode = $("invoiceItemBarcode")?.value.trim() || "";
    const quantity = num($("invoiceItemQuantity")?.value, 1);
    const price = num($("invoiceItemPrice")?.value, 0);
    const costPrice = num($("invoiceItemCostPrice")?.value, 0);

    if (!itemCode || !itemName) return alert("Item code and item name are required.");
    if (quantity <= 0) return alert("Quantity must be greater than zero.");

    currentInvoiceItems.push(normalizeInvoiceItem({
      id: uid("line"),
      itemCode,
      itemName,
      barcode,
      quantity,
      price,
      costPrice,
      lineTotal: quantity * price,
      lineProfit: quantity * (price - costPrice),
    }));

    ["invoiceItemLookup", "invoiceItemCode", "invoiceItemName", "invoiceItemBarcode", "invoiceItemQuantity", "invoiceItemPrice", "invoiceItemCostPrice"].forEach((id) => {
      if ($(id)) $(id).value = id === "invoiceItemQuantity" ? "1" : "";
    });

    renderInvoice();
  }

  function loadInvoiceToForm(invoiceId) {
    const invoice = state.invoices.find((row) => String(row.id) === String(invoiceId));
    if (!invoice) return;
    state.invoiceEditId = invoice.id;
    currentInvoiceItems = invoice.items.map(normalizeInvoiceItem);
    invoiceAutoNo = false;
    renderInvoice(invoice);
  }

  async function deleteInvoices(ids) {
    if (!ids.length) return alert("Select at least one invoice.");
    if (!confirm(`Delete ${ids.length} invoice record(s)?`)) return;
    try {
      for (const id of ids) await deleteInvoiceOnServer(id);
      addActivity("invoice", `${ids.length} invoice record(s) deleted`, "invoice");
      await loadAllDataFromServer();
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to delete invoice(s).");
    }
  }

  async function saveInvoiceRecord(event) {
    event.preventDefault();
    const invoice = collectInvoiceFormFields();
    if (!invoice.items.length) return alert("Add at least one invoice item.");

    try {
      await ensureCustomerExistsFromInvoice(invoice);
      await loadCustomersFromServer();

      if (state.invoiceEditId) {
        await updateInvoiceOnServer(invoice);
        addActivity("invoice", `Invoice updated: ${invoice.invoiceNo}`, "invoice");
      } else {
        await createInvoiceOnServer(invoice);
        addActivity("invoice", `Invoice created: ${invoice.invoiceNo}`, "invoice");
      }

      currentInvoiceItems = [];
      state.invoiceEditId = null;
      invoiceAutoNo = true;
      await loadAllDataFromServer();
      renderAll();
      switchPage("sales");
    } catch (error) {
      alert(error.message || "Failed to save invoice.");
    }
  }

  function renderInvoice(prefill = null) {
    const invoice = prefill || state.invoices.find((row) => String(row.id) === String(state.invoiceEditId)) || null;
    const settings = getSettings();
    const customFieldKeys = settings.invoiceCustomFields || [];
    const customerOptions = state.customers.map((row) => `<option value="${escapeHtml(row.name)}"></option>`).join("");
    const invoiceData = invoice || {
      invoiceNo: invoiceAutoNo ? nextInvoiceNumber() : "",
      date: today(),
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      discount: 0,
      tax: 0,
      customFields: {},
    };

    const subtotal = sum(currentInvoiceItems, (item) => item.lineTotal);
    const discountValue = invoice ? invoice.discount : num($("invoiceDiscount")?.value, 0);
    const taxValue = invoice ? invoice.tax : num($("invoiceTax")?.value, 0);
    const total = subtotal - discountValue + taxValue;
    const invoiceNoValue = invoiceAutoNo
      ? invoice?.invoiceNo || generateSevenDigitInvoiceNoClient()
      : invoice?.invoiceNo || "";

    $("invoice").innerHTML = `
      <div class="section-banner">
        <strong>Invoice builder:</strong> lookup by item code, item name, or barcode, editable sale price, discount, tax, and customer auto-creation.
      </div>

      <div class="grid cols-1">
  <div class="card invoice-full-width-card">
          <div class="card-header">
            <div>
              <h3>${invoice ? "Edit Invoice" : "Create Invoice"}</h3>
              <p>Customer phone and address stay hidden from invoice output when left empty.</p>
            </div>
            ${invoice ? `<button class="btn" type="button" id="cancelInvoiceEditBtn">Cancel Edit</button>` : ""}
          </div>

          <form id="invoiceForm">
            <input type="hidden" id="invoiceRecordId" value="${escapeHtml(invoice?.id || "")}" />
            <div class="form-grid invoice-main-grid">
              <div class="field"><label>Invoice Number</label><input id="invoiceNo" value="${escapeHtml(invoiceNoValue)}" /></div>
              <div class="field"><label>Date</label><input id="invoiceDate" type="date" value="${escapeHtml(invoiceData.date || today())}" /></div>
              <div class="field"><label>Customer Name</label><input id="invoiceCustomerName" list="customerNameList" value="${escapeHtml(invoiceData.customerName || "")}" /></div>
              <div class="field"><label>Customer Phone</label><input id="invoiceCustomerPhone" value="${escapeHtml(invoiceData.customerPhone || "")}" /></div>
              <div class="field span-2"><label>Customer Address</label><input id="invoiceCustomerAddress" value="${escapeHtml(invoiceData.customerAddress || "")}" /></div>
              ${customFieldKeys.map((key) => `
                <div class="field"><label>${escapeHtml(key)}</label><input data-invoice-custom="${escapeHtml(key)}" value="${escapeHtml(invoiceData.customFields?.[key] || "")}" /></div>
              `).join("")}
            </div>

            <div class="card" style="margin-top:16px;">
              <div class="card-header">
                <div>
                  <h3>Add Invoice Item</h3>
                  <p>Auto-fill from inventory or barcode, but keep price editable.</p>
                </div>
              </div>
              <div class="form-grid invoice-item-grid-wide">
                <div class="field span-2"><label>Lookup by code, name, or barcode</label><input id="invoiceItemLookup" placeholder="Type item code, item name, or barcode" /></div>
                <div class="field"><label>Item Code</label><input id="invoiceItemCode" /></div>
                <div class="field"><label>Item Name</label><input id="invoiceItemName" /></div>
                <div class="field"><label>Barcode</label><input id="invoiceItemBarcode" /></div>
                <div class="field"><label>Quantity</label><input id="invoiceItemQuantity" type="number" min="1" value="1" /></div>
                <div class="field"><label>Sale Price</label><input id="invoiceItemPrice" type="number" min="0" step="0.01" /></div>
                <div class="field"><label>Cost Price</label><input id="invoiceItemCostPrice" type="number" min="0" step="0.01" /></div>
                <div class="toolbar-actions" style="grid-column:1/-1;">
                  <button class="btn" type="button" id="addInvoiceItemBtn">Add Item</button>
                </div>
              </div>
            </div>

            <div class="card" style="margin-top:16px;">
              <div class="card-header">
                <div>
                  <h3>Invoice Items</h3>
                  <p>Linked item details appear here.</p>
                </div>
              </div>
              ${renderInvoiceItemsTable()}
            </div>

            <div class="form-grid" style="margin-top:16px;">
              <div class="field"><label>Discount</label><input id="invoiceDiscount" type="number" min="0" step="0.01" value="${escapeHtml(String(discountValue || 0))}" /></div>
              <div class="field"><label>Tax</label><input id="invoiceTax" type="number" min="0" step="0.01" value="${escapeHtml(String(taxValue || 0))}" /></div>
            </div>

            <div class="stack-list" style="margin-top:16px;">
              <div class="mini-card"><strong>Subtotal</strong><span>${escapeHtml(money(subtotal))}</span></div>
              <div class="mini-card"><strong>Total</strong><span>${escapeHtml(money(total))}</span></div>
              <div class="mini-card"><strong>Estimated Profit</strong><span>${escapeHtml(money(sum(currentInvoiceItems, (item) => item.lineProfit)))}</span></div>
            </div>

            <div class="toolbar-actions" style="margin-top:18px;">
              <button class="btn" type="button" id="previewInvoiceBtn">Preview</button>
              <button class="btn" type="button" id="downloadInvoiceBtn">Download</button>
              <button class="btn" type="button" id="printInvoiceBtn">Print</button>
              <button class="btn primary" type="submit">Save Invoice</button>
            </div>
          </form>
        </div>

        
    `;

    $("invoiceForm")?.addEventListener("submit", saveInvoiceRecord);
    $("invoiceItemLookup")?.addEventListener("input", invoiceItemLookupFill);
    $("invoiceItemBarcode")?.addEventListener("input", invoiceItemLookupFill);
    $("invoiceCustomerName")?.addEventListener("change", (event) => fillInvoiceCustomerDetails(event.target.value));
    $("addInvoiceItemBtn")?.addEventListener("click", addInvoiceLine);
    $("previewInvoiceBtn")?.addEventListener("click", previewCurrentInvoice);
    $("downloadInvoiceBtn")?.addEventListener("click", downloadCurrentInvoice);
    $("printInvoiceBtn")?.addEventListener("click", printCurrentInvoice);
    $("cancelInvoiceEditBtn")?.addEventListener("click", () => {
      currentInvoiceItems = [];
      state.invoiceEditId = null;
      invoiceAutoNo = true;
      renderInvoice();
    });
    document.querySelectorAll("[data-remove-invoice-line]").forEach((button) => {
      button.addEventListener("click", () => removeInvoiceLine(button.dataset.removeInvoiceLine));
    });
    ["invoiceDiscount", "invoiceTax"].forEach((id) => {
      $(id)?.addEventListener("input", () => renderInvoice(invoice));
    });
  }
  

  function getReportRows(view) {
    const invoices = state.invoices;
    const expenses = getExtraItems("expenses");
    const groups = new Map();

    function ensureGroup(key) {
      if (!groups.has(key)) groups.set(key, { key, sales: 0, profit: 0, invoices: 0, expenses: 0 });
      return groups.get(key);
    }

    invoices.forEach((invoice) => {
      const key = view === "daily" ? dateKey(invoice.date) : view === "weekly" ? weekKey(invoice.date) : view === "yearly" ? yearKey(invoice.date) : monthKey(invoice.date);
      const row = ensureGroup(key);
      row.sales += num(invoice.total);
      row.profit += num(invoice.profit);
      row.invoices += 1;
    });

    expenses.forEach((expense) => {
      const key = view === "daily" ? dateKey(expense.date) : view === "weekly" ? weekKey(expense.date) : view === "yearly" ? yearKey(expense.date) : monthKey(expense.date);
      const row = ensureGroup(key);
      row.expenses += num(expense.amount);
    });

    return [...groups.values()].sort((a, b) => String(b.key).localeCompare(String(a.key)));
  }
  function monthLabelFromKey(key) {
  const [year, month] = String(key || "").split("-");
  if (!year || !month) return key;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function getInvoicesForSelectedSalesPeriod() {
  const period = state.selectedSalesPeriod || "";
  if (!period) return [];
  return state.invoices
    .filter((row) => monthKey(row.date) === period)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function downloadInvoiceDocument(invoice, options = {}) {
  const blob = new Blob([invoiceHtml(invoice, options)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoiceNo || "invoice"}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openInvoiceDocument(invoice, options = {}) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(invoiceHtml(invoice, options));
  previewWindow.document.close();
}

function printInvoiceDocument(invoice, options = {}) {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(invoiceHtml(invoice, options));
  previewWindow.document.close();
  previewWindow.focus();
  setTimeout(() => previewWindow.print(), 300);
}
  function renderSales() {
  const view = state.selectedSalesView || "monthly";
  const rows = getReportRows(view);
  const selectedPeriod = state.selectedSalesPeriod || "";
  const monthlyRows = rows.filter((row) => !selectedPeriod || row.key === selectedPeriod);
  const monthlyInvoices = getInvoicesForSelectedSalesPeriod();
  const showProfitInInvoices = Boolean(state.showProfitInInvoices);

  $("sales").innerHTML = `
    <div class="section-banner">
      <strong>Reports:</strong> switch between daily, weekly, monthly, and yearly views with invoice and expense totals combined.
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Period Reports</h3>
          <p>View revenue, expenses, and profit by period.</p>
        </div>
      </div>

      <div class="toolbar-actions" style="margin-bottom:16px;">
        <button class="btn ${view === "daily" ? "primary" : ""}" data-report-view="daily">Daily</button>
        <button class="btn ${view === "weekly" ? "primary" : ""}" data-report-view="weekly">Weekly</button>
        <button class="btn ${view === "monthly" ? "primary" : ""}" data-report-view="monthly">Monthly</button>
        <button class="btn ${view === "yearly" ? "primary" : ""}" data-report-view="yearly">Yearly</button>
      </div>

      ${rows.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Invoices</th>
                <th>Sales</th>
                <th>Expenses</th>
                <th>Profit</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>
                    ${view === "monthly"
                      ? `<button class="btn btn-link" type="button" data-sales-period="${escapeHtml(row.key)}">${escapeHtml(monthLabelFromKey(row.key))} Sales Report</button>`
                      : escapeHtml(row.key)}
                  </td>
                  <td>${escapeHtml(String(row.invoices))}</td>
                  <td>${escapeHtml(money(row.sales))}</td>
                  <td>${escapeHtml(money(row.expenses))}</td>
                  <td>${escapeHtml(money(row.profit))}</td>
                  <td>${escapeHtml(money(row.profit - row.expenses))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty-state"><h4>No report data yet</h4><p>Create invoices or expenses to populate reports.</p></div>`}
    </div>

    ${selectedPeriod ? `
      <div class="card" style="margin-top:18px;">
        <div class="card-header">
          <div>
            <h3>${escapeHtml(monthLabelFromKey(selectedPeriod))} Sales Report</h3>
            <p>Open invoice documents saved in this month.</p>
          </div>
          <div class="toolbar-actions">
            <button class="btn" type="button" id="clearSalesPeriodBtn">Back to Reports</button>
            <button class="btn ${showProfitInInvoices ? "primary" : ""}" type="button" id="toggleSalesInvoiceProfitBtn">
              ${showProfitInInvoices ? "Hide Profits in Invoices" : "Show Profits in Invoices"}
            </button>
          </div>
        </div>

        ${monthlyInvoices.length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Open</th>
                  <th>Download</th>
                  <th>Print</th>
                </tr>
              </thead>
              <tbody>
                ${monthlyInvoices.map((row) => `
                  <tr>
                    <td><button class="btn btn-link" type="button" data-open-sales-invoice="${escapeHtml(String(row.id))}">${escapeHtml(row.invoiceNo)}</button></td>
                    <td>${escapeHtml(row.date)}</td>
                    <td><button class="btn btn-link" type="button" data-open-sales-invoice="${escapeHtml(String(row.id))}">${escapeHtml(row.customerName || "Walk-in Customer")}</button></td>
                    <td><button class="btn" type="button" data-open-sales-invoice="${escapeHtml(String(row.id))}">Open</button></td>
                    <td><button class="btn" type="button" data-download-sales-invoice="${escapeHtml(String(row.id))}">Download</button></td>
                    <td><button class="btn" type="button" data-print-sales-invoice="${escapeHtml(String(row.id))}">Print</button></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state compact"><h4>No invoices found</h4><p>No invoices were created in this month.</p></div>`}
      </div>
    ` : ""}
  `;

  document.querySelectorAll("[data-report-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSalesView = button.dataset.reportView;
      state.selectedSalesPeriod = "";
      saveUiState();
      renderSales();
    });
  });

  document.querySelectorAll("[data-sales-period]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSalesView = "monthly";
      state.selectedSalesPeriod = button.dataset.salesPeriod || "";
      saveUiState();
      renderSales();
    });
  });

  $("clearSalesPeriodBtn")?.addEventListener("click", () => {
    state.selectedSalesPeriod = "";
    saveUiState();
    renderSales();
  });

  $("toggleSalesInvoiceProfitBtn")?.addEventListener("click", () => {
    state.showProfitInInvoices = !state.showProfitInInvoices;
    saveUiState();
    renderSales();
  });

  document.querySelectorAll("[data-open-sales-invoice]").forEach((button) => {
    button.addEventListener("click", () => {
      const invoice = state.invoices.find((row) => String(row.id) === String(button.dataset.openSalesInvoice));
      if (!invoice) return;
      openInvoiceDocument(invoice, { showProfit: Boolean(state.showProfitInInvoices) });
    });
  });

 document.querySelectorAll("[data-download-sales-invoice]").forEach((button) => {
  button.addEventListener("click", () => {
    const invoice = state.invoices.find((row) => String(row.id) === String(button.dataset.downloadSalesInvoice));
    if (!invoice) return;
    downloadInvoiceDocument(invoice, {
      showProfit: Boolean(state.showProfitInInvoices),
    });
  });
});

  document.querySelectorAll("[data-print-sales-invoice]").forEach((button) => {
    button.addEventListener("click", () => {
      const invoice = state.invoices.find((row) => String(row.id) === String(button.dataset.printSalesInvoice));
      if (!invoice) return;
      printInvoiceDocument(invoice, { showProfit: Boolean(state.showProfitInInvoices) });
    });
  });
}

  function renderSimpleCrudSection(config) {
    const section = $(config.sectionId);
    const q = queryText();
    const rows = getExtraItems(config.key).filter((row) => matches(row, q));

    section.innerHTML = `
      <div class="section-banner"><strong>${escapeHtml(config.bannerTitle)}:</strong> ${escapeHtml(config.bannerText)}</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><div><h3>${escapeHtml(config.formTitle)}</h3><p>${escapeHtml(config.formText)}</p></div></div>
          <form id="${config.key}Form" class="form-grid">
            ${config.fields.map((field) => `
              <div class="field ${field.span === 2 ? "span-2" : ""}">
                <label>${escapeHtml(field.label)}</label>
                ${field.type === "textarea"
                  ? `<textarea id="${config.key}_${field.name}" rows="${field.rows || 3}" ${field.required ? "required" : ""}></textarea>`
                  : `<input id="${config.key}_${field.name}" type="${field.type || "text"}" ${field.required ? "required" : ""} ${field.min != null ? `min="${field.min}"` : ""} ${field.step != null ? `step="${field.step}"` : ""} ${field.value != null ? `value="${field.value}"` : ""} />`}
              </div>
            `).join("")}
            <div class="toolbar-actions" style="grid-column:1/-1;">
              <button class="btn primary" type="submit">Save</button>
            </div>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>${escapeHtml(config.listTitle)}</h3><p>${escapeHtml(config.listText)}</p></div></div>
          ${rows.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr>${config.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}<th>Action</th></tr></thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      ${config.columns.map((col) => `<td>${escapeHtml(String(col.render ? col.render(row) : row[col.key] ?? ""))}</td>`).join("")}
                      <td><button class="btn danger" data-extra-delete="${escapeHtml(row.id)}">Delete</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty-state compact"><h4>No records yet</h4><p>${escapeHtml(config.emptyText)}</p></div>`}
        </div>
      </div>
    `;

    $(`${config.key}Form`)?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = { id: uid(config.key), createdAt: nowIso() };
      config.fields.forEach((field) => {
        next[field.name] = $(`${config.key}_${field.name}`)?.value || "";
      });
      const rowsNext = [next, ...getExtraItems(config.key)];
      setExtraItems(config.key, rowsNext);
      addActivity(config.sectionId, `${config.formTitle} saved`, config.sectionId);
      renderAll();
    });

    section.querySelectorAll("[data-extra-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = getExtraItems(config.key).filter((row) => String(row.id) !== String(button.dataset.extraDelete));
        setExtraItems(config.key, next);
        addActivity(config.sectionId, `${config.formTitle} deleted`, config.sectionId);
        renderAll();
      });
    });
  }

  function renderExpenses() {
    const rows = syncPurchasingExpenses();
    const groups = {
      salaries: rows.filter((row) => row.category === "Salaries"),
      purchasing: rows.filter((row) => row.category === "Purchasing Expenses"),
      taxes: rows.filter((row) => row.category === "Taxes"),
      personal: rows.filter((row) => row.category === "Personal Expenses"),
      utilities: rows.filter((row) => row.category === "Utility Expenses"),
      other: rows.filter((row) => row.category === "Other Expenses"),
    };

    $("expenses").innerHTML = `
      <div class="section-banner"><strong>Expense center:</strong> keep grouped expense records with collapsible categories and salary tracking.</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><div><h3>Add Expense</h3><p>Create grouped expense entries for reports.</p></div></div>
          <form id="expenseForm" class="form-grid">
            <div class="field"><label>Date</label><input id="expenseDate" type="date" value="${today()}" /></div>
            <div class="field"><label>Category</label>
              <select id="expenseCategory">
                <option>Salaries</option>
                <option>Other Expenses</option>
                <option>Purchasing Expenses</option>
                <option>Taxes</option>
                <option>Personal Expenses</option>
                <option>Utility Expenses</option>
              </select>
            </div>
            <div class="field"><label>Title</label><input id="expenseTitle" required /></div>
            <div class="field"><label>Amount</label><input id="expenseAmount" type="number" step="0.01" min="0" required /></div>
            <div class="field"><label>Employee / Related Person</label><input id="expenseEmployee" /></div>
            <div class="field span-2"><label>Details</label><textarea id="expenseDetails" rows="3"></textarea></div>
            <div class="toolbar-actions" style="grid-column:1/-1;"><button class="btn primary" type="submit">Save Expense</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Expense Totals</h3><p>Summary by category.</p></div></div>
          <div class="stack-list">
            ${Object.entries(groups).map(([key, value]) => `<div class="mini-card"><strong>${escapeHtml(key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()))}</strong><span>${escapeHtml(money(sum(value, (item) => item.amount)))}</span></div>`).join("")}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-header"><div><h3>Grouped Expenses</h3><p>Open a group to view its entries.</p></div></div>
        <div class="stack-list">
          ${Object.entries({
            "Salaries": groups.salaries,
            "Other Expenses": groups.other,
            "Purchasing Expenses": groups.purchasing,
            "Taxes": groups.taxes,
            "Personal Expenses": groups.personal,
            "Utility Expenses": groups.utilities,
          }).map(([label, value], index) => `
            <details ${index === 0 ? "open" : ""}>
              <summary><strong>${escapeHtml(label)}</strong> (${value.length})</summary>
              ${value.length ? `
                <div class="table-wrap" style="margin-top:12px;">
                  <table>
                    <thead><tr><th>Date</th><th>Title</th><th>Amount</th><th>Person</th><th>Action</th></tr></thead>
                    <tbody>
                      ${value.map((row) => `
                        <tr>
                          <td>${escapeHtml(row.date)}</td>
                          <td>${escapeHtml(row.title)}</td>
                          <td>${escapeHtml(money(row.amount))}</td>
                          <td>${escapeHtml(row.employee || "-")}</td>
                          <td><button class="btn danger" data-expense-delete="${escapeHtml(row.id)}">Delete</button></td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              ` : `<div class="empty-state compact"><h4>No entries</h4><p>No records in this category yet.</p></div>`}
            </details>
          `).join("")}
        </div>
      </div>
    `;

    $("expenseForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = {
        id: uid("exp"),
        date: $("expenseDate")?.value || today(),
        category: $("expenseCategory")?.value || "Other Expenses",
        title: $("expenseTitle")?.value || "",
        amount: num($("expenseAmount")?.value, 0),
        employee: $("expenseEmployee")?.value || "",
        details: $("expenseDetails")?.value || "",
      };
      setExtraItems("expenses", [next, ...rows]);
      addActivity("expenses", `Expense saved: ${next.title}`, "expenses");
      renderAll();
    });

    document.querySelectorAll("[data-expense-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        setExtraItems("expenses", rows.filter((row) => String(row.id) !== String(button.dataset.expenseDelete)));
        addActivity("expenses", "Expense deleted", "expenses");
        renderAll();
      });
    });
  }

  function renderCases() {
    renderSimpleCrudSection({
      sectionId: "cases",
      key: "cases",
      bannerTitle: "Case tracking",
      bannerText: "Track issue cases, linked customers, status, and resolution notes.",
      formTitle: "New Case",
      formText: "Useful for support and service workflows.",
      listTitle: "Case List",
      listText: "Manage all case records.",
      emptyText: "Create your first case.",
      fields: [
        { name: "date", label: "Date", type: "date", value: today() },
        { name: "customer", label: "Customer" },
        { name: "title", label: "Title", required: true },
        { name: "status", label: "Status" },
        { name: "details", label: "Details", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "customer", label: "Customer" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
      ],
    });
  }

  function renderOpportunities() {
    renderSimpleCrudSection({
      sectionId: "opportunities",
      key: "opportunities",
      bannerTitle: "Opportunity tracking",
      bannerText: "Track leads, stage, expected value, and B2B follow-up.",
      formTitle: "New Opportunity",
      formText: "Useful for B2B pipeline management.",
      listTitle: "Opportunity List",
      listText: "Manage all opportunity records.",
      emptyText: "Create your first opportunity.",
      fields: [
        { name: "date", label: "Date", type: "date", value: today() },
        { name: "company", label: "Company" },
        { name: "title", label: "Title", required: true },
        { name: "stage", label: "Stage" },
        { name: "value", label: "Expected Value", type: "number", step: 0.01, min: 0 },
        { name: "details", label: "Notes", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "company", label: "Company" },
        { key: "title", label: "Title" },
        { key: "stage", label: "Stage" },
        { key: "value", label: "Value", render: (row) => money(row.value) },
      ],
    });
  }

  function renderTasks() {
    const rows = getExtraItems("tasks");
    $("tasks").innerHTML = `
      <div class="section-banner"><strong>Task manager:</strong> create internal tasks and mark them complete when done.</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><div><h3>New Task</h3><p>Track due dates, owners, and priority.</p></div></div>
          <form id="taskForm" class="form-grid">
            <div class="field"><label>Task</label><input id="taskTitle" required /></div>
            <div class="field"><label>Due Date</label><input id="taskDueDate" type="date" value="${today()}" /></div>
            <div class="field"><label>Owner</label><input id="taskOwner" /></div>
            <div class="field"><label>Priority</label><input id="taskPriority" placeholder="Low / Medium / High" /></div>
            <div class="field span-2"><label>Notes</label><textarea id="taskNotes" rows="3"></textarea></div>
            <div class="toolbar-actions" style="grid-column:1/-1;"><button class="btn primary" type="submit">Save Task</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Task List</h3><p>Open tasks and completed tasks.</p></div></div>
          ${rows.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Due</th><th>Owner</th><th>Priority</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td>${escapeHtml(row.title)}</td>
                      <td>${escapeHtml(row.dueDate)}</td>
                      <td>${escapeHtml(row.owner)}</td>
                      <td>${escapeHtml(row.priority)}</td>
                      <td>${escapeHtml(row.done ? "Done" : "Open")}</td>
                      <td>
                        <div class="table-actions">
                          <button class="btn" data-task-toggle="${escapeHtml(row.id)}">${row.done ? "Reopen" : "Done"}</button>
                          <button class="btn danger" data-task-delete="${escapeHtml(row.id)}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty-state compact"><h4>No tasks yet</h4><p>Create a task to start tracking work.</p></div>`}
        </div>
      </div>
    `;

    $("taskForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = {
        id: uid("task"),
        title: $("taskTitle")?.value || "",
        dueDate: $("taskDueDate")?.value || today(),
        owner: $("taskOwner")?.value || "",
        priority: $("taskPriority")?.value || "",
        notes: $("taskNotes")?.value || "",
        done: false,
      };
      setExtraItems("tasks", [next, ...rows]);
      addActivity("tasks", `Task created: ${next.title}`, "tasks");
      renderAll();
    });

    document.querySelectorAll("[data-task-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = rows.map((row) => String(row.id) === String(button.dataset.taskToggle) ? { ...row, done: !row.done } : row);
        setExtraItems("tasks", next);
        addActivity("tasks", "Task status updated", "tasks");
        renderAll();
      });
    });

    document.querySelectorAll("[data-task-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        setExtraItems("tasks", rows.filter((row) => String(row.id) !== String(button.dataset.taskDelete)));
        addActivity("tasks", "Task deleted", "tasks");
        renderAll();
      });
    });
  }

  function renderReturns() {
    const rows = getExtraItems("returns");
    $("returns").innerHTML = `
      <div class="section-banner"><strong>Returns & refunds:</strong> keep return records linked to invoice number, customer, and item details.</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><div><h3>Create Return / Refund</h3><p>Link to invoice, customer, and inventory item.</p></div></div>
          <form id="returnForm" class="form-grid">
            <div class="field"><label>Date</label><input id="returnDate" type="date" value="${today()}" /></div>
            <div class="field"><label>Invoice No</label><input id="returnInvoiceNo" /></div>
            <div class="field"><label>Customer</label><input id="returnCustomer" /></div>
            <div class="field"><label>Item</label><input id="returnItem" /></div>
            <div class="field"><label>Quantity</label><input id="returnQty" type="number" min="1" value="1" /></div>
            <div class="field"><label>Refund Amount</label><input id="returnAmount" type="number" min="0" step="0.01" /></div>
            <div class="field span-2"><label>Reason</label><textarea id="returnReason" rows="3"></textarea></div>
            <div class="toolbar-actions" style="grid-column:1/-1;"><button class="btn primary" type="submit">Save Return</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Return List</h3><p>Saved return and refund records.</p></div></div>
          ${rows.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Item</th><th>Refund</th><th>Action</th></tr></thead>
                <tbody>
                  ${rows.map((row) => `
                    <tr>
                      <td>${escapeHtml(row.date)}</td>
                      <td>${escapeHtml(row.invoiceNo)}</td>
                      <td>${escapeHtml(row.customer)}</td>
                      <td>${escapeHtml(row.item)}</td>
                      <td>${escapeHtml(money(row.amount))}</td>
                      <td><button class="btn danger" data-return-delete="${escapeHtml(row.id)}">Delete</button></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty-state compact"><h4>No returns yet</h4><p>Create your first return or refund record.</p></div>`}
        </div>
      </div>
    `;

    $("returnForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = {
        id: uid("ret"),
        date: $("returnDate")?.value || today(),
        invoiceNo: $("returnInvoiceNo")?.value || "",
        customer: $("returnCustomer")?.value || "",
        item: $("returnItem")?.value || "",
        qty: num($("returnQty")?.value, 1),
        amount: num($("returnAmount")?.value, 0),
        reason: $("returnReason")?.value || "",
      };
      setExtraItems("returns", [next, ...rows]);
      addActivity("returns", `Return saved for invoice ${next.invoiceNo || "-"}`, "returns");
      renderAll();
    });

    document.querySelectorAll("[data-return-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        setExtraItems("returns", rows.filter((row) => String(row.id) !== String(button.dataset.returnDelete)));
        addActivity("returns", "Return deleted", "returns");
        renderAll();
      });
    });
  }

  function renderEmails() {
    renderSimpleCrudSection({
      sectionId: "emails",
      key: "emails",
      bannerTitle: "Email log",
      bannerText: "Track B2B communication notes, follow-ups, and account contact history.",
      formTitle: "New Email Log",
      formText: "Save outbound or inbound email notes for B2B workflows.",
      listTitle: "Email Log List",
      listText: "Saved communication records.",
      emptyText: "Save your first email note.",
      fields: [
        { name: "date", label: "Date", type: "date", value: today() },
        { name: "company", label: "Company / Contact" },
        { name: "subject", label: "Subject", required: true },
        { name: "direction", label: "Direction" },
        { name: "details", label: "Summary", type: "textarea", span: 2 },
      ],
      columns: [
        { key: "date", label: "Date" },
        { key: "company", label: "Company / Contact" },
        { key: "subject", label: "Subject" },
        { key: "direction", label: "Direction" },
      ],
    });
  }

  
  function renderBarcode() {
    const rows = getExtraItems("barcodes");
    const itemOptions = state.inventory.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.itemCode} - ${item.itemName}`)}</option>`).join("");

    $("barcode").innerHTML = `
      <div class="section-banner"><strong>Barcode setup:</strong> link scanned barcodes with inventory items and optionally create a new item directly.</div>
      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><div><h3>Link Barcode</h3><p>Attach a barcode to an existing inventory item.</p></div></div>
          <form id="barcodeForm" class="form-grid">
            <div class="field"><label>Barcode</label><input id="barcodeValue" required placeholder="Scan or type barcode" /></div>
            <div class="field"><label>Inventory Item</label><select id="barcodeItemId"><option value="">Select item</option>${itemOptions}</select></div>
            <div class="toolbar-actions" style="grid-column:1/-1;"><button class="btn primary" type="submit">Save Barcode Link</button></div>
          </form>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Create New Item + Barcode</h3><p>Quickly create a new inventory item and link the barcode in one step.</p></div></div>
          <form id="barcodeNewItemForm" class="form-grid">
            <div class="field"><label>Barcode</label><input id="newBarcodeValue" required /></div>
            <div class="field"><label>Item Code</label><input id="newBarcodeItemCode" required /></div>
            <div class="field"><label>Item Name</label><input id="newBarcodeItemName" required /></div>
            <div class="field"><label>Current Stock</label><input id="newBarcodeStock" type="number" min="0" value="0" /></div>
            <div class="field"><label>Minimum Qty</label><input id="newBarcodeMin" type="number" min="0" value="0" /></div>
            <div class="field"><label>Sale Price</label><input id="newBarcodeSale" type="number" min="0" step="0.01" value="0" /></div>
            <div class="field"><label>Cost Price</label><input id="newBarcodeCost" type="number" min="0" step="0.01" value="0" /></div>
            <div class="toolbar-actions" style="grid-column:1/-1;"><button class="btn primary" type="submit">Create Item + Link Barcode</button></div>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-header"><div><h3>Linked Barcodes</h3><p>These links are used during invoice item lookup.</p></div></div>
        ${rows.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Barcode</th><th>Item Code</th><th>Item Name</th><th>Action</th></tr></thead>
              <tbody>
                ${rows.map((row) => {
                  const item = state.inventory.find((entry) => String(entry.id) === String(row.itemId));
                  return `
                    <tr>
                      <td>${escapeHtml(row.barcode)}</td>
                      <td>${escapeHtml(item?.itemCode || "-")}</td>
                      <td>${escapeHtml(item?.itemName || "Item removed")}</td>
                      <td><button class="btn danger" data-barcode-delete="${escapeHtml(row.id)}">Delete</button></td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state compact"><h4>No barcode links yet</h4><p>Link a barcode to start scan-based invoice lookup.</p></div>`}
      </div>
    `;

    $("barcodeForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const barcode = $("barcodeValue")?.value.trim();
      const itemId = $("barcodeItemId")?.value;
      if (!barcode || !itemId) return alert("Barcode and inventory item are required.");
      const next = [{ id: uid("bar"), barcode, itemId }, ...rows.filter((row) => row.barcode !== barcode)];
      setExtraItems("barcodes", next);
      addActivity("barcode", `Barcode linked: ${barcode}`, "barcode");
      renderAll();
    });

    $("barcodeNewItemForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const item = normalizeInventoryItem({
        itemCode: $("newBarcodeItemCode")?.value,
        itemName: $("newBarcodeItemName")?.value,
        currentStock: $("newBarcodeStock")?.value,
        minimumQty: $("newBarcodeMin")?.value,
        salePrice: $("newBarcodeSale")?.value,
        costPrice: $("newBarcodeCost")?.value,
      });
      const barcode = $("newBarcodeValue")?.value.trim();
      if (!barcode || !item.itemCode || !item.itemName) return alert("Barcode, item code, and item name are required.");
      try {
        await createInventoryOnServer(item);
        await loadInventoryFromServer();
        const created = state.inventory.find((entry) => entry.itemCode.toLowerCase() === item.itemCode.toLowerCase());
        if (created) {
          setExtraItems("barcodes", [{ id: uid("bar"), barcode, itemId: created.id }, ...rows.filter((row) => row.barcode !== barcode)]);
        }
        addActivity("barcode", `New item created and barcode linked: ${barcode}`, "barcode");
        renderAll();
      } catch (error) {
        alert(error.message || "Failed to create inventory item from barcode setup.");
      }
    });

    document.querySelectorAll("[data-barcode-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        setExtraItems("barcodes", rows.filter((row) => String(row.id) !== String(button.dataset.barcodeDelete)));
        addActivity("barcode", "Barcode link deleted", "barcode");
        renderAll();
      });
    });
  }

  function renderSettingsControls() {
    const settings = getSettings();
    if ($("settingsBusinessName")) $("settingsBusinessName").value = settings.businessName || state.company.name || "";
    if ($("settingsBusinessTagline")) $("settingsBusinessTagline").value = settings.invoiceTagline || "";
    if ($("prefCollapseForms")) $("prefCollapseForms").checked = !!settings.collapseFormsByDefault;
    if ($("prefShowDashboardActivity")) $("prefShowDashboardActivity").checked = !!settings.showDashboardActivity;
    if ($("prefEnableB2B")) $("prefEnableB2B").checked = !!settings.enableB2B;
    if ($("prefEnableBarcode")) $("prefEnableBarcode").checked = !!settings.enableBarcode;
    if ($("summaryModeSelect")) {
      $("summaryModeSelect").innerHTML = `<option value="numbers">Cards only</option>`;
      $("summaryModeSelect").value = "numbers";
      $("summaryModeSelect").disabled = true;
    }
    if ($("businessModeSelect")) $("businessModeSelect").value = settings.businessMode || "hybrid";

    const summaryGrid = $("summarySettingsGrid");
    const navigationGrid = $("navigationSettingsGrid");
    const activityGrid = $("activitySettingsGrid");

    if (summaryGrid) {
      summaryGrid.innerHTML = SETTINGS_SUMMARY_WIDGETS.map(([id, label]) => `
        <label class="check-tile"><input type="checkbox" data-settings-summary="${escapeHtml(id)}" ${settings.summaryWidgets.includes(id) ? "checked" : ""} /><span><strong>${escapeHtml(label)}</strong><small>Show this widget on the dashboard.</small></span></label>
      `).join("");
    }

    if (navigationGrid) {
      navigationGrid.innerHTML = BASE_NAV.map(([id, , label]) => `
        <label class="check-tile"><input type="checkbox" data-settings-nav="${escapeHtml(id)}" ${settings.visibleNavTabs.includes(id) ? "checked" : ""} /><span><strong>${escapeHtml(label)}</strong><small>Show this module in navigation.</small></span></label>
      `).join("");
    }

    if (activityGrid) {
      activityGrid.innerHTML = BASE_NAV.map(([id, , label]) => `
        <label class="check-tile"><input type="checkbox" data-settings-activity="${escapeHtml(id)}" ${settings.activityModules.includes(id) ? "checked" : ""} /><span><strong>${escapeHtml(label)}</strong><small>Allow this module to feed recent activity.</small></span></label>
      `).join("");
    }
  }

  function collectSettingsFromModal() {
    const current = getSettings();
    const next = {
      ...current,
      businessName: $("settingsBusinessName")?.value.trim() || current.businessName,
      invoiceTagline: $("settingsBusinessTagline")?.value.trim() || "",
      collapseFormsByDefault: !!$("prefCollapseForms")?.checked,
      showDashboardActivity: !!$("prefShowDashboardActivity")?.checked,
      enableB2B: !!$("prefEnableB2B")?.checked,
      enableBarcode: !!$("prefEnableBarcode")?.checked,
      summaryMode: "numbers",
      businessMode: $("businessModeSelect")?.value || "hybrid",
      summaryWidgets: [...document.querySelectorAll("[data-settings-summary]:checked")].map((input) => input.dataset.settingsSummary).filter((id) => ["sales", "expenses", "profit"].includes(id)),
      visibleNavTabs: [...document.querySelectorAll("[data-settings-nav]:checked")].map((input) => input.dataset.settingsNav),
      activityModules: [...document.querySelectorAll("[data-settings-activity]:checked")].map((input) => input.dataset.settingsActivity),
      businessLogo: current.businessLogo,
    };

    const logoFile = $("settingsBusinessLogo")?.files?.[0];
    if (logoFile) {
      const reader = new FileReader();
      reader.onload = () => {
        next.businessLogo = String(reader.result || "");
        saveSettings(next);
        addActivity("dashboard", "Settings updated with new business logo", "dashboard");
        renderAll();
        closeSettingsModal();
      };
      reader.readAsDataURL(logoFile);
      return null;
    }

    return next;
  }

  function saveSettingsFromModal() {
    const settings = collectSettingsFromModal();
    if (!settings) return;
    saveSettings(settings);
    addActivity("dashboard", "Settings updated", "dashboard");
    renderAll();
    closeSettingsModal();
  }

  function restoreDefaultSettings() {
    if (!confirm("Restore default settings?")) return;
    saveSettings(defaultSettings());
    renderSettingsControls();
    renderAll();
  }

  function exportData() {
    const payload = {
      exportedAt: nowIso(),
      workspaceId: getWorkspaceId(),
      settings: getSettings(),
      state: {
        company: state.company,
        customers: state.customers,
        inventory: state.inventory,
        purchases: state.purchases,
        invoices: state.invoices,
      },
      extra: getExtraData(),
    };
    downloadJson(payload, `cresscox-export-${today()}.json`);
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function bindSelectionCounter({
  rowSelector,
  selectAllId,
  deleteBtnId,
  exportBtnId,
  deleteBaseText,
  exportBaseText,
}) {
  const updateLabels = () => {
    const checked = document.querySelectorAll(`${rowSelector}:checked`).length;

    const deleteBtn = $(deleteBtnId);
    const exportBtn = $(exportBtnId);

    if (deleteBtn) {
      deleteBtn.textContent = checked ? `${deleteBaseText} (${checked})` : deleteBaseText;
    }

    if (exportBtn) {
      exportBtn.textContent = checked ? `${exportBaseText} (${checked})` : exportBaseText;
    }
  };

  document.querySelectorAll(rowSelector).forEach((box) => {
    box.addEventListener("change", updateLabels);
  });

  $(selectAllId)?.addEventListener("change", () => {
    setTimeout(updateLabels, 0);
  });

  updateLabels();
}

  async function importData(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);

      const mapped = {
        customers: Array.isArray(raw.customers) ? raw.customers : Array.isArray(raw.state?.customers) ? raw.state.customers : [],
        inventory: Array.isArray(raw.inventory) ? raw.inventory : Array.isArray(raw.state?.inventory) ? raw.state.inventory : [],
        purchases: Array.isArray(raw.purchases) ? raw.purchases : Array.isArray(raw.state?.purchases) ? raw.state.purchases : [],
        invoices: Array.isArray(raw.invoices) ? raw.invoices : Array.isArray(raw.state?.invoices) ? raw.state.invoices : [],
      };

      const detected = Object.entries(mapped).filter(([, value]) => value.length).map(([key]) => key);
      if (!detected.length) return alert("No importable records detected in this file.");
      if (!confirm(`Import detected modules: ${detected.join(", ")} ? Existing server records for those modules will stay unless you clear them manually.`)) return;

      for (const customer of mapped.customers.map(normalizeCustomer)) {
        await createCustomerOnServer(customer);
      }
      for (const item of mapped.inventory.map(normalizeInventoryItem)) {
        await createInventoryOnServer(item);
      }
      for (const purchase of mapped.purchases.map(normalizePurchase)) {
        await createPurchaseOnServer(purchase);
      }
      for (const invoice of mapped.invoices.map(normalizeInvoice)) {
        await createInvoiceOnServer(invoice);
      }

      if (raw.settings) saveSettings({ ...getSettings(), ...raw.settings });
      if (raw.extra) saveExtraData(normalizeExtraData(raw.extra));

      addActivity("dashboard", `Import completed using smart mapping for: ${detected.join(", ")}`, "dashboard");
      await loadAllDataFromServer();
      renderAll();
      alert("Import completed.");
    } catch (error) {
      alert(error.message || "Failed to import data.");
    }
  }

  async function clearAll() {
    if (!confirm("Clear all saved ERP data for this workspace? This cannot be undone.")) return;
    try {
      for (const invoice of state.invoices) await deleteInvoiceOnServer(invoice.id);
      for (const purchase of state.purchases) await deletePurchaseOnServer(purchase.id);
      for (const item of state.inventory) await deleteInventoryOnServer(item.id);
      for (const customer of state.customers) await deleteCustomerOnServer(customer.id);
      saveExtraData(defaultExtraData());
      currentInvoiceItems = [];
      state = normalizeState(loadUiState());
      await loadAllDataFromServer();
      addActivity("dashboard", "Workspace data cleared", "dashboard");
      renderAll();
    } catch (error) {
      alert(error.message || "Failed to clear workspace data.");
    }
  }

  function bindTopEvents() {
    if (topEventsBound) return;

    $("globalSearch")?.addEventListener("input", () => renderAll());
    $("exportBtn")?.addEventListener("click", exportData);
    $("resetBtn")?.addEventListener("click", clearAll);
    $("logoutBtn")?.addEventListener("click", logout);
    $("importFile")?.addEventListener("change", (event) => {
      importData(event.target.files?.[0]);
      event.target.value = "";
    });

    $("accountMenuBtn")?.addEventListener("click", (event) => {
      event.stopPropagation();
      const dropdown = $("accountDropdown");
      toggleAccountDropdown(dropdown?.hidden);
    });

    $("profileBtn")?.addEventListener("click", () => {
      toggleAccountDropdown(false);
      openSettingsModal("profile");
    });

    $("profileSettingsBtn")?.addEventListener("click", () => {
      toggleAccountDropdown(false);
      openSettingsModal("profile");
    });

    $("workspaceInfoBtn")?.addEventListener("click", () => {
      toggleAccountDropdown(false);
      openSettingsModal("settings");
    });

    $("helpSupportBtn")?.addEventListener("click", () => {
      toggleAccountDropdown(false);
      window.open("https://cresscox.com", "_blank", "noopener,noreferrer");
    });

    $("settingsHelpBtn")?.addEventListener("click", () => {
      window.open("https://cresscox.com", "_blank", "noopener,noreferrer");
    });

    $("saveSettingsBtn")?.addEventListener("click", saveSettingsFromModal);
    $("saveSettingsBtnTop")?.addEventListener("click", saveSettingsFromModal);
    $("defaultSettingsBtn")?.addEventListener("click", restoreDefaultSettings);
    $("defaultSettingsBtnTop")?.addEventListener("click", restoreDefaultSettings);
    $("settingsLogoutBtn")?.addEventListener("click", logout);
    $("closeSettingsModalBtn")?.addEventListener("click", closeSettingsModal);
    $("settingsModal")?.addEventListener("click", (event) => {
      if (event.target?.id === "settingsModal") closeSettingsModal();
    });

    document.addEventListener("click", (event) => {
      const area = document.querySelector(".topbar-account");
      if (area && !area.contains(event.target)) toggleAccountDropdown(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        toggleAccountDropdown(false);
        closeSettingsModal();
      }
    });

    topEventsBound = true;
  }

  function renderAll() {
    populateAccountUI();
    renderNav();
    setHeader();
    renderDashboard();
    renderCustomers();
    renderInventory();
    renderPurchasing();
    renderSales();
    renderInvoice();
    renderExpenses();
    renderCases();
    renderOpportunities();
    renderTasks();
    renderReturns();
    renderEmails();
    renderBarcode();
    syncPurchasingExpenses();
  }

  async function init() {
    state = normalizeState(loadUiState());
    bindTopEvents();

    try {
      await loadAllDataFromServer();
      const settings = getSettings();
      state.company.name = settings.businessName || state.company.name;
      state.customerFormOpen = settings.collapseFormsByDefault ? false : state.customerFormOpen;
      state.inventoryFormOpen = settings.collapseFormsByDefault ? false : state.inventoryFormOpen;
      state.purchaseFormOpen = settings.collapseFormsByDefault ? false : state.purchaseFormOpen;
      renderAll();
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to load workspace data.");
    }
  }

  init();
})();
