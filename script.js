(() => {
  "use strict";

  const API = "http://localhost:4000/api";
  const LOGIN_PAGE = "http://127.0.0.1:5500/loginregister.html";

  const meta = {
    dashboard: [
      "Dashboard",
      "Overview of customers, stock, purchasing, sales, and invoices.",
    ],
    customers: [
      "Customer Tab",
      "Customer records with contact and address details.",
    ],
    inventory: [
      "Inventory Tab",
      "Item list with stock, minimum quantity, cost, sale price, and item code.",
    ],
    purchasing: [
      "Purchasing Tab",
      "Record purchased items and automatically update inventory stock.",
    ],
    sales: [
      "Monthly Sales Record Tab",
      "Saved invoices, total sales, and profit analysis.",
    ],
    invoice: [
      "Daily Invoice Tab",
      "Create, edit, print, download, and reset invoices quickly.",
    ],
  };

  let state = null;
  let currentPage = "dashboard";
  let currentInvoiceItems = [];
  let topEventsBound = false;

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function getWorkspaceId() {
    return localStorage.getItem("workspaceId") || "";
  }

  function getUiStorageKey() {
    const workspaceId = getWorkspaceId() || "guest";
    return `cresscox-ui-${workspaceId}`;
  }

  function logout() {
    const ok = confirm("Are you sure you want to logout?");
    if (!ok) return;

    localStorage.removeItem("token");
    localStorage.removeItem("workspaceId");
    localStorage.removeItem("userEmail");
    window.location.href = LOGIN_PAGE;
  }

  if (!getToken() || !getWorkspaceId()) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();

    const response = await fetch(`${API}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
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
      const message =
        data.error ||
        data.message ||
        data.raw ||
        `Request failed: ${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return data;
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthName(dateStr) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime())
      ? "Unknown"
      : d.toLocaleString(undefined, { month: "long", year: "numeric" });
  }

  function money(n) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "EUR",
    }).format(Number(n || 0));
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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
    return (
      document.getElementById("globalSearch")?.value?.trim().toLowerCase() || ""
    );
  }

  function matches(obj, q) {
    if (!q) return true;
    return Object.values(obj)
      .join(" ")
      .toLowerCase()
      .includes(q);
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
      customerEditId: null,
      inventoryEditId: null,
      purchaseEditId: null,
      invoiceEditId: null,
      customerFormOpen: true,
      inventoryFormOpen: true,
      purchaseFormOpen: true,
      selectedSalesMonth: "",
    };
  }

  function seedState() {
    return normalizeState({
      company: {
        name: "CresscoX",
        address: "17 Market Street, Berlin",
        phone: "+49 30 000000",
        email: "sales@cresscox.com",
      },
      customers: [
        {
          id: "1",
          name: "Ali Traders",
          phone: "+49 155 410001",
          email: "ali@traders.com",
          address: "Berlin, Germany",
          notes: "Regular wholesale buyer.",
        },
        {
          id: "2",
          name: "Sara Boutique",
          phone: "+49 155 410002",
          email: "sara@boutique.com",
          address: "Hamburg, Germany",
          notes: "Needs monthly invoice copy.",
        },
      ],
      inventory: [
        {
          id: "1",
          itemCode: "ITM-1001",
          itemName: "Rice Bag 10kg",
          currentStock: 22,
          minimumQty: 10,
          salePrice: 28,
          costPrice: 22,
        },
        {
          id: "2",
          itemCode: "ITM-1002",
          itemName: "Cooking Oil 5L",
          currentStock: 8,
          minimumQty: 12,
          salePrice: 14,
          costPrice: 10,
        },
        {
          id: "3",
          itemCode: "ITM-1003",
          itemName: "Tea Pack 1kg",
          currentStock: 35,
          minimumQty: 15,
          salePrice: 9,
          costPrice: 6,
        },
      ],
      purchases: [
        {
          id: "1",
          date: today(),
          supplier: "Fresh Supply Co",
          itemCode: "ITM-1001",
          itemName: "Rice Bag 10kg",
          quantity: 10,
          costPrice: 22,
          note: "Weekly replenishment",
        },
        {
          id: "2",
          date: today(),
          supplier: "Oil World",
          itemCode: "ITM-1002",
          itemName: "Cooking Oil 5L",
          quantity: 20,
          costPrice: 10,
          note: "Special discount batch",
        },
      ],
      invoices: [],
    });
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
      note: String(row.note || "").trim(),
    };
  }

  function normalizeInvoiceItem(row = {}) {
    const quantity = num(row.quantity);
    const price = num(row.price);
    const costPrice = num(row.costPrice ?? row.cost_price);
    const lineTotal = num(row.lineTotal ?? row.line_total, quantity * price);
    const lineProfit = num(
      row.lineProfit ?? row.line_profit,
      quantity * (price - costPrice)
    );

    return {
      id: String(row.id || uid("line")),
      itemCode: String(row.itemCode || row.item_code || "").trim(),
      itemName: String(row.itemName || row.item_name || "").trim(),
      quantity,
      price,
      costPrice,
      lineTotal,
      lineProfit,
    };
  }

  function recalculateInvoiceTotals(invoice) {
    const items = Array.isArray(invoice.items)
      ? invoice.items.map(normalizeInvoiceItem)
      : [];

    const total = items.reduce((sum, item) => sum + num(item.lineTotal), 0);
    const profit = items.reduce((sum, item) => sum + num(item.lineProfit), 0);

    return {
      ...invoice,
      items,
      total,
      profit,
    };
  }

  function normalizeInvoice(row = {}) {
    const invoice = {
      id: String(row.id || uid("invc")),
      invoiceNo: String(row.invoiceNo || row.invoice_no || "").trim(),
      date: String(row.date || row.invoiceDate || row.invoice_date || today()),
      customerName: String(row.customerName || row.customer_name || "").trim(),
      customerPhone: String(row.customerPhone || row.customer_phone || "").trim(),
      customerAddress: String(
        row.customerAddress || row.customer_address || ""
      ).trim(),
      items: Array.isArray(row.items) ? row.items.map(normalizeInvoiceItem) : [],
      total: num(row.total),
      profit: num(row.profit),
    };

    return recalculateInvoiceTotals(invoice);
  }

  function normalizeState(raw = {}) {
    const base = defaultState();
    return {
      ...base,
      ...raw,
      company: {
        ...base.company,
        ...(raw.company || {}),
      },
      customers: Array.isArray(raw.customers)
        ? raw.customers.map(normalizeCustomer)
        : [],
      inventory: Array.isArray(raw.inventory)
        ? raw.inventory.map(normalizeInventoryItem)
        : [],
      purchases: Array.isArray(raw.purchases)
        ? raw.purchases.map(normalizePurchase)
        : [],
      invoices: Array.isArray(raw.invoices)
        ? raw.invoices.map(normalizeInvoice)
        : [],
      customerEditId: raw.customerEditId || null,
      inventoryEditId: raw.inventoryEditId || null,
      purchaseEditId: raw.purchaseEditId || null,
      invoiceEditId: raw.invoiceEditId || null,
      customerFormOpen: raw.customerFormOpen !== false,
      inventoryFormOpen: raw.inventoryFormOpen !== false,
      purchaseFormOpen: raw.purchaseFormOpen !== false,
      selectedSalesMonth: raw.selectedSalesMonth || "",
    };
  }

  function loadUiState() {
    try {
      const raw = localStorage.getItem(getUiStorageKey());
      if (!raw) return defaultState();
      const ui = JSON.parse(raw);
      return normalizeState({
        customerEditId: ui.customerEditId || null,
        inventoryEditId: ui.inventoryEditId || null,
        purchaseEditId: ui.purchaseEditId || null,
        invoiceEditId: ui.invoiceEditId || null,
        customerFormOpen: ui.customerFormOpen !== false,
        inventoryFormOpen: ui.inventoryFormOpen !== false,
        purchaseFormOpen: ui.purchaseFormOpen !== false,
        selectedSalesMonth: ui.selectedSalesMonth || "",
      });
    } catch (error) {
      console.error("Failed to load UI state:", error);
      return defaultState();
    }
  }

  function saveUiState() {
    localStorage.setItem(
      getUiStorageKey(),
      JSON.stringify({
        customerEditId: state.customerEditId,
        inventoryEditId: state.inventoryEditId,
        purchaseEditId: state.purchaseEditId,
        invoiceEditId: state.invoiceEditId,
        customerFormOpen: state.customerFormOpen,
        inventoryFormOpen: state.inventoryFormOpen,
        purchaseFormOpen: state.purchaseFormOpen,
        selectedSalesMonth: state.selectedSalesMonth,
      })
    );
  }

  async function loadCustomersFromServer() {
    const workspaceId = getWorkspaceId();
    const rows = await apiFetch(`/workspaces/${workspaceId}/customers`);
    state.customers = Array.isArray(rows) ? rows.map(normalizeCustomer) : [];
  }

  async function createCustomerOnServer(customer) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/customers`, {
      method: "POST",
      body: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
      },
    });
  }

  async function updateCustomerOnServer(customer) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/customers/${customer.id}`, {
      method: "PUT",
      body: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        notes: customer.notes,
      },
    });
  }

  async function deleteCustomerOnServer(id) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/customers/${id}`, {
      method: "DELETE",
    });
  }

  async function loadInventoryFromServer() {
    const workspaceId = getWorkspaceId();
    const rows = await apiFetch(`/workspaces/${workspaceId}/inventory`);
    state.inventory = Array.isArray(rows)
      ? rows.map(normalizeInventoryItem)
      : [];
  }

  async function createInventoryOnServer(item) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/inventory`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/inventory/${item.id}`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/inventory/${id}`, {
      method: "DELETE",
    });
  }

  async function loadPurchasesFromServer() {
    const workspaceId = getWorkspaceId();
    const rows = await apiFetch(`/workspaces/${workspaceId}/purchases`);
    state.purchases = Array.isArray(rows) ? rows.map(normalizePurchase) : [];
  }

  async function createPurchaseOnServer(purchase) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/purchases`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/purchases/${purchase.id}`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/purchases/${id}`, {
      method: "DELETE",
    });
  }

  async function loadInvoicesFromServer() {
    const workspaceId = getWorkspaceId();
    const rows = await apiFetch(`/workspaces/${workspaceId}/invoices`);
    state.invoices = Array.isArray(rows) ? rows.map(normalizeInvoice) : [];
  }

  async function createInvoiceOnServer(invoice) {
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/invoices`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/invoices/${invoice.id}`, {
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
    const workspaceId = getWorkspaceId();
    await apiFetch(`/workspaces/${workspaceId}/invoices/${id}`, {
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

  async function clearWorkspaceDataOnServer() {
    const invoiceIds = state.invoices.map((x) => x.id);
    const purchaseIds = state.purchases.map((x) => x.id);
    const inventoryIds = state.inventory.map((x) => x.id);
    const customerIds = state.customers.map((x) => x.id);

    for (const id of invoiceIds) {
      await deleteInvoiceOnServer(id);
    }
    for (const id of purchaseIds) {
      await deletePurchaseOnServer(id);
    }
    for (const id of inventoryIds) {
      await deleteInventoryOnServer(id);
    }
    for (const id of customerIds) {
      await deleteCustomerOnServer(id);
    }

    await loadAllDataFromServer();
  }

  async function replaceWorkspaceDataOnServer(nextState) {
    await clearWorkspaceDataOnServer();

    for (const customer of nextState.customers) {
      await createCustomerOnServer(customer);
    }

    for (const item of nextState.inventory) {
      await createInventoryOnServer(item);
    }

    for (const purchase of nextState.purchases) {
      await createPurchaseOnServer(purchase);
    }

    for (const invoice of nextState.invoices) {
      await createInvoiceOnServer(invoice);
    }

    await loadAllDataFromServer();
  }

  function navData() {
    return [
      ["dashboard", "🏠", "Dashboard", ""],
      ["customers", "👥", "Customers", state.customers.length],
      ["inventory", "📦", "Inventory", state.inventory.length],
      ["purchasing", "🛒", "Purchasing", state.purchases.length],
      ["sales", "📈", "Monthly Sales", state.invoices.length],
      ["invoice", "🧾", "Daily Invoice", ""],
    ];
  }

  function renderNav() {
    const nav = document.getElementById("nav");
    if (!nav) return;

    nav.innerHTML = navData()
      .map(
        ([id, icon, label, count]) => `
        <button class="${id === currentPage ? "active" : ""}" data-page="${id}">
          <span class="nav-main">
            <span class="nav-icon">${icon}</span>
            <span>${label}</span>
          </span>
          <span class="nav-count">${count ?? ""}</span>
        </button>
      `
      )
      .join("");

    nav.querySelectorAll("button").forEach((btn) => {
      btn.onclick = () => switchPage(btn.dataset.page);
    });
  }

  function switchPage(page) {
    if (!meta[page]) return;
    currentPage = page;
    saveUiState();
    renderAll();
  }

  function setHeader() {
    const titleEl = document.getElementById("pageTitle");
    const subtitleEl = document.getElementById("pageSubtitle");
    if (titleEl) titleEl.textContent = meta[currentPage][0];
    if (subtitleEl) subtitleEl.textContent = meta[currentPage][1];

    document.querySelectorAll(".section").forEach((sec) => {
      sec.classList.remove("active");
    });

    document.getElementById(currentPage)?.classList.add("active");
  }

  function dashboardStats() {
    const totalStock = state.inventory.reduce(
      (sum, item) => sum + num(item.currentStock),
      0
    );
    const lowStockItems = state.inventory.filter(
      (item) => num(item.currentStock) < num(item.minimumQty)
    ).length;
    const totalSales = state.invoices.reduce(
      (sum, inv) => sum + num(inv.total),
      0
    );
    const totalProfit = state.invoices.reduce(
      (sum, inv) => sum + num(inv.profit),
      0
    );
    const todayInvoices = state.invoices.filter((inv) => inv.date === today())
      .length;

    return {
      totalStock,
      lowStockItems,
      totalSales,
      totalProfit,
      todayInvoices,
    };
  }

  function renderDashboard() {
    const s = dashboardStats();
    const recentInvoices = [...state.invoices]
      .sort((a, b) =>
        `${b.date}${b.invoiceNo}`.localeCompare(`${a.date}${a.invoiceNo}`)
      )
      .slice(0, 5);

    const lowItems = state.inventory
      .filter((item) => num(item.currentStock) < num(item.minimumQty))
      .slice(0, 6);

    document.getElementById("dashboard").innerHTML = `
      <div class="section-banner">
        <strong>Welcome to CresscoX ERP.</strong>
        Manage customers, stock, purchases, invoices, sales, and profits in one workspace.
      </div>

      <div class="grid cols-4">
        <div class="card metric">
          <div class="label">Total Customers</div>
          <div class="value">${state.customers.length}</div>
          <div class="sub">Saved customer records</div>
        </div>
        <div class="card metric">
          <div class="label">Total Stock Units</div>
          <div class="value">${s.totalStock}</div>
          <div class="sub">All inventory units combined</div>
        </div>
        <div class="card metric">
          <div class="label">Total Sales</div>
          <div class="value">${money(s.totalSales)}</div>
          <div class="sub">From saved invoices</div>
        </div>
        <div class="card metric">
          <div class="label">Total Profit</div>
          <div class="value">${money(s.totalProfit)}</div>
          <div class="sub">Sales minus cost</div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:16px;">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Recent invoices</h3>
              <p>Latest invoices created from the daily invoice tab.</p>
            </div>
            <button class="btn primary" id="goInvoiceFromDashboard">New Invoice</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Profit</th>
                </tr>
              </thead>
              <tbody>
                ${
                  recentInvoices.length
                    ? recentInvoices
                        .map(
                          (inv) => `
                  <tr>
                    <td>${escapeHtml(inv.invoiceNo)}</td>
                    <td>${escapeHtml(inv.date)}</td>
                    <td>${escapeHtml(inv.customerName || "Walk-in Customer")}</td>
                    <td>${money(inv.total)}</td>
                    <td>${money(inv.profit)}</td>
                  </tr>
                `
                        )
                        .join("")
                    : `<tr><td colspan="5"><div class="empty">No invoices yet.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <h3>Low stock warning</h3>
          <p>These items should be restocked soon.</p>
          <div class="list" style="margin-top:14px;">
            ${
              lowItems.length
                ? lowItems
                    .map(
                      (item) => `
                <div class="mini-card" style="background:#fff5f5;border-color:#fecaca;">
                  <div class="row-actions" style="justify-content:space-between;">
                    <h4 style="margin:0;">${escapeHtml(item.itemName)}</h4>
                    <span class="pill red">Low Stock</span>
                  </div>
                  <p>Code: ${escapeHtml(item.itemCode)}</p>
                  <p>Current stock: <strong>${item.currentStock}</strong> | Minimum: <strong>${item.minimumQty}</strong></p>
                </div>
              `
                    )
                    .join("")
                : `<div class="ok-box">No items are below minimum quantity right now.</div>`
            }
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="summary-strip">
          <div class="summary-box">Invoices Today<strong>${s.todayInvoices}</strong></div>
          <div class="summary-box">Inventory Items<strong>${state.inventory.length}</strong></div>
          <div class="summary-box">Purchase Records<strong>${state.purchases.length}</strong></div>
        </div>
      </div>
    `;

    document.getElementById("goInvoiceFromDashboard")?.addEventListener("click", () => {
      switchPage("invoice");
    });
  }

  function fillCustomerForm() {
    const customer = state.customerEditId
      ? state.customers.find((x) => String(x.id) === String(state.customerEditId))
      : null;

    if (!document.getElementById("customerName")) return;

    document.getElementById("customerName").value = customer?.name || "";
    document.getElementById("customerPhone").value = customer?.phone || "";
    document.getElementById("customerEmail").value = customer?.email || "";
    document.getElementById("customerAddress").value = customer?.address || "";
    document.getElementById("customerNotes").value = customer?.notes || "";
  }

  function startEditCustomer(id) {
    state.customerEditId = id;
    state.customerFormOpen = true;
    saveUiState();
    renderCustomers();
  }

  function cancelCustomerEdit() {
    state.customerEditId = null;
    saveUiState();
    renderCustomers();
  }

  async function saveCustomer() {
    const payload = normalizeCustomer({
      id: state.customerEditId || "",
      name: document.getElementById("customerName")?.value || "",
      phone: document.getElementById("customerPhone")?.value || "",
      email: document.getElementById("customerEmail")?.value || "",
      address: document.getElementById("customerAddress")?.value || "",
      notes: document.getElementById("customerNotes")?.value || "",
    });

    if (!payload.name) {
      alert("Customer name is required.");
      return;
    }

    try {
      if (state.customerEditId) {
        await updateCustomerOnServer(payload);
      } else {
        await createCustomerOnServer(payload);
      }

      await loadCustomersFromServer();
      state.customerEditId = null;
      state.customerFormOpen = true;
      saveUiState();
      renderAll();
      alert("Customer saved successfully.");
    } catch (error) {
      console.error("Customer save failed:", error);
      alert(error.message || "Failed to save customer.");
    }
  }

  async function deleteCustomer(id) {
    const customer = state.customers.find((entry) => String(entry.id) === String(id));
    if (!customer) return;

    if (!confirm(`Delete customer "${customer.name}"?`)) return;

    try {
      await deleteCustomerOnServer(id);
      await loadCustomersFromServer();

      if (String(state.customerEditId) === String(id)) {
        state.customerEditId = null;
      }

      saveUiState();
      renderAll();
      alert("Customer deleted successfully.");
    } catch (error) {
      console.error("Customer delete failed:", error);
      alert(error.message || "Failed to delete customer.");
    }
  }

  function renderCustomers() {
    const q = queryText();
    const rows = state.customers.filter((c) => matches(c, q));
    const open = state.customerFormOpen !== false;

    document.getElementById("customers").innerHTML = `
      <div class="section-banner">
        <strong>Customer tab:</strong> use the collapsible form below and view records underneath.
      </div>

      <button class="collapsible-toggle ${open ? "open" : ""}" id="customerFormToggle">
        <span>${state.customerEditId ? "Edit Customer" : "New Customer Form"}</span>
        <span class="chev">⌄</span>
      </button>

      <div class="collapsible-panel ${open ? "open" : ""}" id="customerFormPanel">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${state.customerEditId ? "Edit Customer" : "Add Customer"}</h3>
              <p>Create or update customer details.</p>
            </div>
            ${
              state.customerEditId
                ? `<button class="btn" id="cancelCustomerEditBtn">Cancel Edit</button>`
                : ""
            }
          </div>

          <div class="form-grid" style="grid-template-columns:1fr;max-width:560px;">
            <div class="field"><label>Customer Name</label><input id="customerName"></div>
            <div class="field"><label>Phone</label><input id="customerPhone"></div>
            <div class="field"><label>Email</label><input id="customerEmail"></div>
            <div class="field"><label>Address</label><input id="customerAddress"></div>
            <div class="field"><label>Notes</label><textarea id="customerNotes"></textarea></div>
          </div>

          <div class="row-actions" style="margin-top:14px;">
            <button class="btn primary" id="saveCustomerBtn">
              ${state.customerEditId ? "Update Customer" : "Save Customer"}
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div>
            <h3>Customer List</h3>
            <p>All saved customers in one place.</p>
          </div>
          <span class="pill">${rows.length} record(s)</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map(
                        (c) => `
                  <tr>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td>${escapeHtml(c.phone)}</td>
                    <td>${escapeHtml(c.email)}</td>
                    <td>${escapeHtml(c.address)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn" data-edit-customer="${c.id}">Edit</button>
                        <button class="btn danger" data-del-customer="${c.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `
                      )
                      .join("")
                  : `<tr><td colspan="5"><div class="empty">No customers found.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("customerFormToggle")?.addEventListener("click", () => {
      state.customerFormOpen = !open;
      saveUiState();
      renderCustomers();
    });

    document.getElementById("saveCustomerBtn")?.addEventListener("click", saveCustomer);
    document
      .getElementById("cancelCustomerEditBtn")
      ?.addEventListener("click", cancelCustomerEdit);

    document.querySelectorAll("[data-edit-customer]").forEach((btn) => {
      btn.addEventListener("click", () => startEditCustomer(btn.dataset.editCustomer));
    });

    document.querySelectorAll("[data-del-customer]").forEach((btn) => {
      btn.addEventListener("click", () => deleteCustomer(btn.dataset.delCustomer));
    });

    if (open) fillCustomerForm();
  }

  function fillInventoryForm() {
    const item = state.inventoryEditId
      ? state.inventory.find((x) => String(x.id) === String(state.inventoryEditId))
      : null;

    if (!document.getElementById("invItemCode")) return;

    document.getElementById("invItemCode").value = item?.itemCode || "";
    document.getElementById("invItemName").value = item?.itemName || "";
    document.getElementById("invCurrentStock").value = item?.currentStock ?? 0;
    document.getElementById("invMinimumQty").value = item?.minimumQty ?? 0;
    document.getElementById("invSalePrice").value = item?.salePrice ?? 0;
    document.getElementById("invCostPrice").value = item?.costPrice ?? 0;
  }

  function startEditInventory(id) {
    state.inventoryEditId = id;
    state.inventoryFormOpen = true;
    saveUiState();
    renderInventory();
  }

  function cancelInventoryEdit() {
    state.inventoryEditId = null;
    saveUiState();
    renderInventory();
  }

  async function saveInventory() {
    const payload = normalizeInventoryItem({
      id: state.inventoryEditId || "",
      itemCode: document.getElementById("invItemCode")?.value || "",
      itemName: document.getElementById("invItemName")?.value || "",
      currentStock: document.getElementById("invCurrentStock")?.value || 0,
      minimumQty: document.getElementById("invMinimumQty")?.value || 0,
      salePrice: document.getElementById("invSalePrice")?.value || 0,
      costPrice: document.getElementById("invCostPrice")?.value || 0,
    });

    if (!payload.itemCode || !payload.itemName) {
      alert("Item code and item name are required.");
      return;
    }

    const duplicate = state.inventory.some(
      (item) =>
        String(item.id) !== String(payload.id) &&
        item.itemCode.toLowerCase() === payload.itemCode.toLowerCase()
    );

    if (duplicate) {
      alert("An inventory item with this code already exists.");
      return;
    }

    try {
      if (state.inventoryEditId) {
        await updateInventoryOnServer(payload);
      } else {
        await createInventoryOnServer(payload);
      }

      await loadInventoryFromServer();
      state.inventoryEditId = null;
      state.inventoryFormOpen = true;
      saveUiState();
      renderAll();
      alert("Inventory saved successfully.");
    } catch (error) {
      console.error("Inventory save failed:", error);
      alert(error.message || "Failed to save inventory.");
    }
  }

  async function deleteInventory(id) {
    const item = state.inventory.find((entry) => String(entry.id) === String(id));
    if (!item) return;

    if (!confirm(`Delete inventory item "${item.itemName}"?`)) return;

    try {
      await deleteInventoryOnServer(id);
      await loadInventoryFromServer();

      if (String(state.inventoryEditId) === String(id)) {
        state.inventoryEditId = null;
      }

      currentInvoiceItems = currentInvoiceItems.filter(
        (line) => line.itemCode.toLowerCase() !== item.itemCode.toLowerCase()
      );

      saveUiState();
      renderAll();
      alert("Inventory deleted successfully.");
    } catch (error) {
      console.error("Inventory delete failed:", error);
      alert(error.message || "Failed to delete inventory.");
    }
  }

  function renderInventory() {
    const q = queryText();
    const rows = state.inventory.filter((i) => matches(i, q));
    const open = state.inventoryFormOpen !== false;

    document.getElementById("inventory").innerHTML = `
      <div class="section-banner">
        <strong>Inventory tab:</strong> expand the inventory form vertically when needed and view records below.
      </div>

      <button class="collapsible-toggle ${open ? "open" : ""}" id="inventoryFormToggle">
        <span>${state.inventoryEditId ? "Edit Inventory Item" : "New Inventory Form"}</span>
        <span class="chev">⌄</span>
      </button>

      <div class="collapsible-panel ${open ? "open" : ""}" id="inventoryFormPanel">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${state.inventoryEditId ? "Edit Inventory Item" : "Add Inventory Item"}</h3>
              <p>Add a new item or update an existing stock record.</p>
            </div>
            ${
              state.inventoryEditId
                ? `<button class="btn" id="cancelInventoryEditBtn">Cancel Edit</button>`
                : ""
            }
          </div>

          <div class="form-grid" style="grid-template-columns:1fr;max-width:560px;">
            <div class="field"><label>Item Code</label><input id="invItemCode"></div>
            <div class="field"><label>Item Name</label><input id="invItemName"></div>
            <div class="field"><label>Current Stock</label><input id="invCurrentStock" type="number" min="0"></div>
            <div class="field"><label>Minimum Quantity</label><input id="invMinimumQty" type="number" min="0"></div>
            <div class="field"><label>Sale Price</label><input id="invSalePrice" type="number" min="0" step="0.01"></div>
            <div class="field"><label>Cost Price</label><input id="invCostPrice" type="number" min="0" step="0.01"></div>
          </div>

          <div class="row-actions" style="margin-top:14px;">
            <button class="btn primary" id="saveInventoryBtn">
              ${state.inventoryEditId ? "Update Item" : "Save Item"}
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div>
            <h3>Inventory Records</h3>
            <p>Check quantity, prices, and low stock conditions.</p>
          </div>
          <span class="pill">${rows.length} item(s)</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Current Stock</th>
                <th>Minimum Qty</th>
                <th>Sale Price</th>
                <th>Cost Price</th>
                <th>Condition</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map((item) => {
                        const low = num(item.currentStock) < num(item.minimumQty);
                        return `
                          <tr class="${low ? "low-stock-row" : ""}">
                            <td>${escapeHtml(item.itemCode)}</td>
                            <td><strong>${escapeHtml(item.itemName)}</strong></td>
                            <td>${item.currentStock}</td>
                            <td>${item.minimumQty}</td>
                            <td>${money(item.salePrice)}</td>
                            <td>${money(item.costPrice)}</td>
                            <td>${low ? `<span class="pill red">Low Stock</span>` : `<span class="pill green">Normal</span>`}</td>
                            <td>
                              <div class="row-actions">
                                <button class="btn" data-edit-item="${item.id}">Edit</button>
                                <button class="btn danger" data-del-item="${item.id}">Delete</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      })
                      .join("")
                  : `<tr><td colspan="8"><div class="empty">No inventory items found.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("inventoryFormToggle")?.addEventListener("click", () => {
      state.inventoryFormOpen = !open;
      saveUiState();
      renderInventory();
    });

    document.getElementById("saveInventoryBtn")?.addEventListener("click", saveInventory);
    document
      .getElementById("cancelInventoryEditBtn")
      ?.addEventListener("click", cancelInventoryEdit);

    document.querySelectorAll("[data-edit-item]").forEach((btn) => {
      btn.addEventListener("click", () => startEditInventory(btn.dataset.editItem));
    });

    document.querySelectorAll("[data-del-item]").forEach((btn) => {
      btn.addEventListener("click", () => deleteInventory(btn.dataset.delItem));
    });

    if (open) fillInventoryForm();
  }

  function fillPurchaseForm() {
    const purchase = state.purchaseEditId
      ? state.purchases.find((x) => String(x.id) === String(state.purchaseEditId))
      : null;

    if (!document.getElementById("purchaseDate")) return;

    document.getElementById("purchaseDate").value = purchase?.date || today();
    document.getElementById("purchaseSupplier").value = purchase?.supplier || "";
    document.getElementById("purchaseItemCode").value = purchase?.itemCode || "";
    document.getElementById("purchaseItemName").value = purchase?.itemName || "";
    document.getElementById("purchaseQty").value = purchase?.quantity ?? "";
    document.getElementById("purchaseCostPrice").value = purchase?.costPrice ?? "";
    document.getElementById("purchaseNote").value = purchase?.note || "";
  }

  function purchaseCodeLookup() {
    const code = (document.getElementById("purchaseItemCode")?.value || "").trim();
    const item = state.inventory.find(
      (entry) => entry.itemCode.toLowerCase() === code.toLowerCase()
    );

    const nameInput = document.getElementById("purchaseItemName");
    const costInput = document.getElementById("purchaseCostPrice");

    if (item) {
      if (nameInput && !nameInput.value.trim()) nameInput.value = item.itemName;
      if (costInput && !costInput.value.trim()) costInput.value = item.costPrice;
    }
  }

  function startEditPurchase(id) {
    state.purchaseEditId = id;
    state.purchaseFormOpen = true;
    saveUiState();
    renderPurchasing();
  }

  function cancelPurchaseEdit() {
    state.purchaseEditId = null;
    saveUiState();
    renderPurchasing();
  }

  async function savePurchase() {
    const payload = normalizePurchase({
      id: state.purchaseEditId || "",
      date: document.getElementById("purchaseDate")?.value || today(),
      supplier: document.getElementById("purchaseSupplier")?.value || "",
      itemCode: document.getElementById("purchaseItemCode")?.value || "",
      itemName: document.getElementById("purchaseItemName")?.value || "",
      quantity: document.getElementById("purchaseQty")?.value || 0,
      costPrice: document.getElementById("purchaseCostPrice")?.value || 0,
      note: document.getElementById("purchaseNote")?.value || "",
    });

    if (!payload.itemCode || !payload.itemName || payload.quantity <= 0) {
      alert("Item code, item name, and quantity are required.");
      return;
    }

    try {
      if (state.purchaseEditId) {
        await updatePurchaseOnServer(payload);
      } else {
        await createPurchaseOnServer(payload);
      }

      await Promise.all([loadPurchasesFromServer(), loadInventoryFromServer()]);

      state.purchaseEditId = null;
      state.purchaseFormOpen = true;
      saveUiState();
      renderAll();
      alert("Purchase saved successfully.");
    } catch (error) {
      console.error("Purchase save failed:", error);
      alert(error.message || "Failed to save purchase.");
    }
  }

  async function deletePurchase(id) {
    const purchase = state.purchases.find((entry) => String(entry.id) === String(id));
    if (!purchase) return;

    if (!confirm(`Delete purchase for "${purchase.itemName}"?`)) return;

    try {
      await deletePurchaseOnServer(id);
      await Promise.all([loadPurchasesFromServer(), loadInventoryFromServer()]);

      if (String(state.purchaseEditId) === String(id)) {
        state.purchaseEditId = null;
      }

      saveUiState();
      renderAll();
      alert("Purchase deleted successfully.");
    } catch (error) {
      console.error("Purchase delete failed:", error);
      alert(error.message || "Failed to delete purchase.");
    }
  }

  function renderPurchasing() {
    const q = queryText();
    const rows = state.purchases.filter((p) => matches(p, q));
    const open = state.purchaseFormOpen !== false;

    document.getElementById("purchasing").innerHTML = `
      <div class="section-banner">
        <strong>Purchasing tab:</strong> expand the purchase form vertically when needed and view records below.
      </div>

      <button class="collapsible-toggle ${open ? "open" : ""}" id="purchaseFormToggle">
        <span>${state.purchaseEditId ? "Edit Purchase" : "New Purchase Form"}</span>
        <span class="chev">⌄</span>
      </button>

      <div class="collapsible-panel ${open ? "open" : ""}" id="purchaseFormPanel">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${state.purchaseEditId ? "Edit Purchase" : "Add Purchase"}</h3>
              <p>If the item code exists, the item name appears automatically. New items are also added to inventory by the backend recalculation flow.</p>
            </div>
            ${
              state.purchaseEditId
                ? `<button class="btn" id="cancelPurchaseEditBtn">Cancel Edit</button>`
                : ""
            }
          </div>

          <div class="form-grid" style="grid-template-columns:1fr;max-width:560px;">
            <div class="field"><label>Date</label><input id="purchaseDate" type="date" value="${today()}"></div>
            <div class="field"><label>Supplier</label><input id="purchaseSupplier"></div>
            <div class="field"><label>Item Code</label><input id="purchaseItemCode"></div>
            <div class="field"><label>Item Name</label><input id="purchaseItemName" placeholder="Auto shows if code exists"></div>
            <div class="field"><label>Quantity</label><input id="purchaseQty" type="number" min="1"></div>
            <div class="field"><label>Cost Price</label><input id="purchaseCostPrice" type="number" min="0" step="0.01"></div>
            <div class="field"><label>Note</label><textarea id="purchaseNote"></textarea></div>
          </div>

          <div class="row-actions" style="margin-top:14px;">
            <button class="btn primary" id="savePurchaseBtn">
              ${state.purchaseEditId ? "Update Purchase" : "Save Purchase"}
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div>
            <h3>Purchase Records</h3>
            <p>History of purchased items.</p>
          </div>
          <span class="pill">${rows.length} record(s)</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Supplier</th>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Cost Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                rows.length
                  ? rows
                      .map(
                        (p) => `
                  <tr>
                    <td>${escapeHtml(p.date)}</td>
                    <td>${escapeHtml(p.supplier)}</td>
                    <td>${escapeHtml(p.itemCode)}</td>
                    <td>${escapeHtml(p.itemName)}</td>
                    <td>${p.quantity}</td>
                    <td>${money(p.costPrice)}</td>
                    <td>
                      <div class="row-actions">
                        <button class="btn" data-edit-purchase="${p.id}">Edit</button>
                        <button class="btn danger" data-del-purchase="${p.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `
                      )
                      .join("")
                  : `<tr><td colspan="7"><div class="empty">No purchase records found.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById("purchaseFormToggle")?.addEventListener("click", () => {
      state.purchaseFormOpen = !open;
      saveUiState();
      renderPurchasing();
    });

    document
      .getElementById("purchaseItemCode")
      ?.addEventListener("input", purchaseCodeLookup);

    document.getElementById("savePurchaseBtn")?.addEventListener("click", savePurchase);
    document
      .getElementById("cancelPurchaseEditBtn")
      ?.addEventListener("click", cancelPurchaseEdit);

    document.querySelectorAll("[data-edit-purchase]").forEach((btn) => {
      btn.addEventListener("click", () => startEditPurchase(btn.dataset.editPurchase));
    });

    document.querySelectorAll("[data-del-purchase]").forEach((btn) => {
      btn.addEventListener("click", () => deletePurchase(btn.dataset.delPurchase));
    });

    if (open) fillPurchaseForm();
  }

  function invoiceHtml(invoice) {
    return `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(invoice.invoiceNo || "Invoice")}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
          h1,h2,h3,p { margin: 0 0 10px; }
          .head { display:flex; justify-content:space-between; margin-bottom:24px; }
          .box { border:1px solid #ddd; padding:16px; border-radius:10px; margin-bottom:18px; }
          table { width:100%; border-collapse: collapse; margin-top:12px; }
          th, td { border:1px solid #ddd; padding:10px; text-align:left; }
          th { background:#f5f5f5; }
          .sum { margin-top:20px; width:320px; margin-left:auto; }
          .sum div { display:flex; justify-content:space-between; padding:6px 0; }
          .total { font-weight:700; font-size:18px; border-top:2px solid #111; margin-top:8px; padding-top:8px; }
        </style>
      </head>
      <body>
        <div class="head">
          <div>
            <h1>${escapeHtml(state.company.name)}</h1>
            <p>${escapeHtml(state.company.address)}</p>
            <p>${escapeHtml(state.company.phone)}</p>
            <p>${escapeHtml(state.company.email)}</p>
          </div>
          <div>
            <h2>Invoice</h2>
            <p><strong>No:</strong> ${escapeHtml(invoice.invoiceNo)}</p>
            <p><strong>Date:</strong> ${escapeHtml(invoice.date)}</p>
          </div>
        </div>

        <div class="box">
          <h3>Customer</h3>
          <p>${escapeHtml(invoice.customerName || "Walk-in Customer")}</p>
          <p>${escapeHtml(invoice.customerPhone || "")}</p>
          <p>${escapeHtml(invoice.customerAddress || "")}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Item Name</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items
              .map(
                (item) => `
              <tr>
                <td>${escapeHtml(item.itemCode)}</td>
                <td>${escapeHtml(item.itemName)}</td>
                <td>${item.quantity}</td>
                <td>${money(item.price)}</td>
                <td>${money(item.lineTotal)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div class="sum">
          <div><span>Profit</span><span>${money(invoice.profit)}</span></div>
          <div class="total"><span>Total</span><span>${money(invoice.total)}</span></div>
        </div>
      </body>
      </html>
    `;
  }

  function nextInvoiceNumber() {
    const max = state.invoices.reduce((highest, inv) => {
      const m = String(inv.invoiceNo || "").match(/(\d+)/);
      const n = m ? Number(m[1]) : 0;
      return Math.max(highest, n);
    }, 0);
    return `INV-${String(max + 1).padStart(4, "0")}`;
  }

  function fillInvoiceCustomerFromSaved(name) {
    const customer = state.customers.find(
      (c) => c.name.toLowerCase() === String(name || "").trim().toLowerCase()
    );
    if (!customer) return;

    document.getElementById("invoiceCustomerPhone").value = customer.phone || "";
    document.getElementById("invoiceCustomerAddress").value = customer.address || "";
  }

  function fillInvoiceForm() {
    const invoice = state.invoiceEditId
      ? state.invoices.find((x) => String(x.id) === String(state.invoiceEditId))
      : null;

    document.getElementById("invoiceNo").value =
      invoice?.invoiceNo || nextInvoiceNumber();
    document.getElementById("invoiceDate").value = invoice?.date || today();
    document.getElementById("invoiceCustomerName").value = invoice?.customerName || "";
    document.getElementById("invoiceCustomerPhone").value =
      invoice?.customerPhone || "";
    document.getElementById("invoiceCustomerAddress").value =
      invoice?.customerAddress || "";
  }

  function ensureInvoiceDraft() {
    if (!state.invoiceEditId && currentInvoiceItems.length === 0) {
      document.getElementById("invoiceNo").value ||= nextInvoiceNumber();
      document.getElementById("invoiceDate").value ||= today();
    }
  }

  function renderInvoiceItemsTable() {
    const tbody = document.getElementById("invoiceItemsBody");
    if (!tbody) return;

    tbody.innerHTML = currentInvoiceItems.length
      ? currentInvoiceItems
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.itemCode)}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td>${item.quantity}</td>
            <td>${money(item.price)}</td>
            <td>${money(item.lineTotal)}</td>
            <td>${money(item.lineProfit)}</td>
            <td><button class="btn danger" data-remove-line="${item.id}">Remove</button></td>
          </tr>
        `
          )
          .join("")
      : `<tr><td colspan="7"><div class="empty">No invoice items added yet.</div></td></tr>`;

    tbody.querySelectorAll("[data-remove-line]").forEach((btn) => {
      btn.addEventListener("click", () => removeInvoiceItem(btn.dataset.removeLine));
    });
  }

  function updateInvoicePreview() {
    const invoice = recalculateInvoiceTotals({
      invoiceNo: document.getElementById("invoiceNo")?.value || nextInvoiceNumber(),
      date: document.getElementById("invoiceDate")?.value || today(),
      customerName: document.getElementById("invoiceCustomerName")?.value || "",
      customerPhone: document.getElementById("invoiceCustomerPhone")?.value || "",
      customerAddress: document.getElementById("invoiceCustomerAddress")?.value || "",
      items: currentInvoiceItems,
      total: 0,
      profit: 0,
    });

    document.getElementById("previewInvoiceNo").textContent = invoice.invoiceNo || "-";
    document.getElementById("previewInvoiceDate").textContent = invoice.date || "-";
    document.getElementById("previewCustomerName").textContent =
      invoice.customerName || "Walk-in Customer";
    document.getElementById("previewCustomerPhone").textContent =
      invoice.customerPhone || "-";
    document.getElementById("previewCustomerAddress").textContent =
      invoice.customerAddress || "-";

    const previewBody = document.getElementById("previewItemsBody");
    previewBody.innerHTML = invoice.items.length
      ? invoice.items
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.itemCode)}</td>
            <td>${escapeHtml(item.itemName)}</td>
            <td>${item.quantity}</td>
            <td>${money(item.price)}</td>
            <td>${money(item.lineTotal)}</td>
          </tr>
        `
          )
          .join("")
      : `<tr><td colspan="5">No items yet</td></tr>`;

    document.getElementById("previewSubtotal").textContent = money(invoice.total);
    document.getElementById("previewProfit").textContent = money(invoice.profit);
    document.getElementById("previewTotal").textContent = money(invoice.total);
  }

  function addInvoiceItem() {
    const itemCode = (document.getElementById("lineItemCode")?.value || "").trim();
    const itemName = (document.getElementById("lineItemName")?.value || "").trim();
    const quantity = num(document.getElementById("lineQty")?.value);
    const price = num(document.getElementById("linePrice")?.value);

    if (!itemCode || !itemName || quantity <= 0) {
      alert("Item code, item name, and quantity are required.");
      return;
    }

    const inventoryItem = state.inventory.find(
      (item) => item.itemCode.toLowerCase() === itemCode.toLowerCase()
    );

    const costPrice = num(inventoryItem?.costPrice);
    const line = normalizeInvoiceItem({
      itemCode,
      itemName,
      quantity,
      price,
      costPrice,
    });

    currentInvoiceItems.push(line);

    document.getElementById("lineItemCode").value = "";
    document.getElementById("lineItemName").value = "";
    document.getElementById("lineQty").value = "";
    document.getElementById("linePrice").value = "";

    renderInvoiceItemsTable();
    updateInvoicePreview();
  }

  function removeInvoiceItem(id) {
    currentInvoiceItems = currentInvoiceItems.filter((item) => String(item.id) !== String(id));
    renderInvoiceItemsTable();
    updateInvoicePreview();
  }

  function buildInvoicePayload() {
    const invoice = normalizeInvoice({
      id: state.invoiceEditId || "",
      invoiceNo: document.getElementById("invoiceNo")?.value || nextInvoiceNumber(),
      date: document.getElementById("invoiceDate")?.value || today(),
      customerName: document.getElementById("invoiceCustomerName")?.value || "",
      customerPhone: document.getElementById("invoiceCustomerPhone")?.value || "",
      customerAddress: document.getElementById("invoiceCustomerAddress")?.value || "",
      items: currentInvoiceItems,
    });

    return recalculateInvoiceTotals(invoice);
  }

  async function saveInvoice() {
    const payload = buildInvoicePayload();

    if (!payload.invoiceNo) {
      alert("Invoice number is required.");
      return;
    }

    if (!payload.items.length) {
      alert("Add at least one invoice item.");
      return;
    }

    const duplicate = state.invoices.some(
      (invoice) =>
        String(invoice.id) !== String(payload.id) &&
        invoice.invoiceNo.toLowerCase() === payload.invoiceNo.toLowerCase()
    );

    if (duplicate) {
      alert("An invoice with this number already exists.");
      return;
    }

    const insufficient = payload.items.find((line) => {
      const item = state.inventory.find(
        (entry) => entry.itemCode.toLowerCase() === line.itemCode.toLowerCase()
      );
      return item && num(item.currentStock) < num(line.quantity);
    });

    if (insufficient) {
      alert(`Not enough stock for ${insufficient.itemName}.`);
      return;
    }

    try {
      if (state.invoiceEditId) {
        await updateInvoiceOnServer(payload);
      } else {
        await createInvoiceOnServer(payload);
      }

      await Promise.all([loadInvoicesFromServer(), loadInventoryFromServer()]);

      state.invoiceEditId = null;
      currentInvoiceItems = [];
      saveUiState();
      renderAll();
      switchPage("sales");
      alert("Invoice saved successfully.");
    } catch (error) {
      console.error("Invoice save failed:", error);
      alert(error.message || "Failed to save invoice.");
    }
  }

  function cancelInvoiceEdit() {
    if (!confirm("Cancel invoice editing?")) return;
    state.invoiceEditId = null;
    currentInvoiceItems = [];
    saveUiState();
    renderInvoice();
  }

  function resetInvoiceDraft() {
    if (!confirm("Reset the current invoice draft?")) return;
    state.invoiceEditId = null;
    currentInvoiceItems = [];
    saveUiState();
    renderInvoice();
  }

  function loadInvoiceForEdit(id) {
    const invoice = state.invoices.find((entry) => String(entry.id) === String(id));
    if (!invoice) return;

    state.invoiceEditId = id;
    currentInvoiceItems = invoice.items.map(normalizeInvoiceItem);
    saveUiState();
    switchPage("invoice");
  }

  async function deleteInvoice(id) {
    const invoice = state.invoices.find((entry) => String(entry.id) === String(id));
    if (!invoice) return;

    if (!confirm(`Delete invoice "${invoice.invoiceNo}"?`)) return;

    try {
      await deleteInvoiceOnServer(id);
      await Promise.all([loadInvoicesFromServer(), loadInventoryFromServer()]);

      if (String(state.invoiceEditId) === String(id)) {
        state.invoiceEditId = null;
        currentInvoiceItems = [];
      }

      saveUiState();
      renderAll();
      alert("Invoice deleted successfully.");
    } catch (error) {
      console.error("Invoice delete failed:", error);
      alert(error.message || "Failed to delete invoice.");
    }
  }

  function previewCurrentInvoice(auto = false) {
    const invoice = buildInvoicePayload();
    if (!auto && !invoice.items.length) {
      alert("Add at least one item before preview.");
      return;
    }

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) return;

    previewWindow.document.open();
    previewWindow.document.write(invoiceHtml(invoice));
    previewWindow.document.close();
  }

  function downloadCurrentInvoice() {
    const invoice = buildInvoicePayload();
    if (!invoice.items.length) {
      alert("Add at least one item before downloading.");
      return;
    }

    const blob = new Blob([invoiceHtml(invoice)], {
      type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNo || "invoice"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderInvoice() {
    const customerOptions = state.customers
      .map(
        (c) =>
          `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`
      )
      .join("");

    document.getElementById("invoice").innerHTML = `
      <div class="section-banner">
        <strong>Daily invoice tab:</strong> create invoices, add items, preview, print, and save directly to the database.
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>${state.invoiceEditId ? "Edit Invoice" : "Create Invoice"}</h3>
              <p>Build the invoice and save it to this workspace only.</p>
            </div>
            ${
              state.invoiceEditId
                ? `<button class="btn" id="cancelInvoiceEditBtn">Cancel Edit</button>`
                : ""
            }
          </div>

          <div class="form-grid">
            <div class="field">
              <label>Invoice Number</label>
              <input id="invoiceNo" />
            </div>

            <div class="field">
              <label>Date</label>
              <input id="invoiceDate" type="date" />
            </div>

            <div class="field">
              <label>Customer Name</label>
              <input id="invoiceCustomerName" list="customerNameList" placeholder="Walk-in Customer or saved customer name" />
              <datalist id="customerNameList">${customerOptions}</datalist>
            </div>

            <div class="field">
              <label>Customer Phone</label>
              <input id="invoiceCustomerPhone" />
            </div>

            <div class="field" style="grid-column:1/-1;">
              <label>Customer Address</label>
              <input id="invoiceCustomerAddress" />
            </div>
          </div>

          <div class="card" style="margin-top:16px;">
            <div class="card-header">
              <div>
                <h3>Add Invoice Item</h3>
                <p>Item price can be manual. Cost price comes from inventory for profit calculation.</p>
              </div>
            </div>

            <div class="form-grid">
              <div class="field"><label>Item Code</label><input id="lineItemCode" /></div>
              <div class="field"><label>Item Name</label><input id="lineItemName" /></div>
              <div class="field"><label>Quantity</label><input id="lineQty" type="number" min="1" /></div>
              <div class="field"><label>Sale Price</label><input id="linePrice" type="number" min="0" step="0.01" /></div>
            </div>

            <div class="row-actions" style="margin-top:14px;">
              <button class="btn primary" id="addInvoiceItemBtn">Add Item</button>
            </div>
          </div>

          <div class="card" style="margin-top:16px;">
            <div class="card-header">
              <div>
                <h3>Invoice Items</h3>
                <p>Current lines in the draft.</p>
              </div>
              <span class="pill">${currentInvoiceItems.length} line(s)</span>
            </div>

            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th>Profit</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="invoiceItemsBody"></tbody>
              </table>
            </div>

            <div class="row-actions" style="margin-top:16px;">
              <button class="btn primary" id="saveInvoiceBtn">
                ${state.invoiceEditId ? "Update Invoice" : "Save Invoice"}
              </button>
              <button class="btn" id="previewInvoiceBtn">Preview</button>
              <button class="btn" id="downloadInvoiceBtn">Download HTML</button>
              <button class="btn warn" id="resetInvoiceBtn">Reset Draft</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Invoice Preview</h3>
              <p>Live preview of the current draft.</p>
            </div>
          </div>

          <div class="mini-card" style="background:#fff; color:#111;">
            <div class="row-actions" style="justify-content:space-between; align-items:flex-start;">
              <div>
                <h2 style="margin:0 0 6px;">${escapeHtml(state.company.name)}</h2>
                <p style="margin:0;">${escapeHtml(state.company.address)}</p>
                <p style="margin:0;">${escapeHtml(state.company.phone)}</p>
                <p style="margin:0;">${escapeHtml(state.company.email)}</p>
              </div>
              <div style="text-align:right;">
                <h3 style="margin:0 0 6px;">Invoice</h3>
                <p style="margin:0;"><strong>No:</strong> <span id="previewInvoiceNo">-</span></p>
                <p style="margin:0;"><strong>Date:</strong> <span id="previewInvoiceDate">-</span></p>
              </div>
            </div>

            <div class="mini-card" style="margin-top:16px;">
              <h4 style="margin:0 0 8px;">Customer</h4>
              <p style="margin:0 0 4px;" id="previewCustomerName">Walk-in Customer</p>
              <p style="margin:0 0 4px;" id="previewCustomerPhone">-</p>
              <p style="margin:0;" id="previewCustomerAddress">-</p>
            </div>

            <table class="invoice-table" style="width:100%; margin-top:16px;">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody id="previewItemsBody">
                <tr><td colspan="5">No items yet</td></tr>
              </tbody>
            </table>

            <div class="invoice-summary" style="margin-top:16px;">
              <div class="row-actions" style="justify-content:space-between;"><span>Subtotal</span><span id="previewSubtotal">${money(0)}</span></div>
              <div class="row-actions" style="justify-content:space-between;"><span>Profit</span><span id="previewProfit">${money(0)}</span></div>
              <div class="row-actions" style="justify-content:space-between; font-weight:700;"><span>Total</span><span id="previewTotal">${money(0)}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;

    fillInvoiceForm();
    ensureInvoiceDraft();
    renderInvoiceItemsTable();
    updateInvoicePreview();

    document.getElementById("invoiceCustomerName")?.addEventListener("change", (e) => {
      fillInvoiceCustomerFromSaved(e.target.value);
      updateInvoicePreview();
    });

    ["invoiceNo", "invoiceDate", "invoiceCustomerName", "invoiceCustomerPhone", "invoiceCustomerAddress"]
      .forEach((id) => {
        document.getElementById(id)?.addEventListener("input", updateInvoicePreview);
      });

    document.getElementById("addInvoiceItemBtn")?.addEventListener("click", addInvoiceItem);
    document.getElementById("saveInvoiceBtn")?.addEventListener("click", saveInvoice);
    document.getElementById("previewInvoiceBtn")?.addEventListener("click", () => previewCurrentInvoice(false));
    document.getElementById("downloadInvoiceBtn")?.addEventListener("click", downloadCurrentInvoice);
    document.getElementById("resetInvoiceBtn")?.addEventListener("click", resetInvoiceDraft);
    document.getElementById("cancelInvoiceEditBtn")?.addEventListener("click", cancelInvoiceEdit);
  }

  function renderSales() {
    const q = queryText();
    const rows = state.invoices.filter((inv) => matches(inv, q));
    const grouped = {};

    rows.forEach((inv) => {
      const key = monthName(inv.date);
      grouped[key] = grouped[key] || {
        sales: 0,
        profit: 0,
        count: 0,
        invoices: [],
      };
      grouped[key].sales += num(inv.total);
      grouped[key].profit += num(inv.profit);
      grouped[key].count += 1;
      grouped[key].invoices.push(inv);
    });

    const totalSales = rows.reduce((s, r) => s + num(r.total), 0);
    const totalProfit = rows.reduce((s, r) => s + num(r.profit), 0);
    const monthOptions = Object.keys(grouped);

    const selected =
      state.selectedSalesMonth && grouped[state.selectedSalesMonth]
        ? state.selectedSalesMonth
        : monthOptions[0] || "";

    state.selectedSalesMonth = selected;
    saveUiState();

    const selectedData = selected ? grouped[selected] : null;

    document.getElementById("sales").innerHTML = `
      <div class="section-banner">
        <strong>Monthly sales tab:</strong> invoices are stored here with printable monthly reporting.
      </div>

      <div class="grid cols-3" style="margin-bottom:16px;">
        <div class="card metric">
          <div class="label">Total Sales</div>
          <div class="value">${money(totalSales)}</div>
          <div class="sub">From saved invoices</div>
        </div>
        <div class="card metric">
          <div class="label">Total Profit</div>
          <div class="value">${money(totalProfit)}</div>
          <div class="sub">Sales minus item cost</div>
        </div>
        <div class="card metric">
          <div class="label">Invoices Stored</div>
          <div class="value">${rows.length}</div>
          <div class="sub">Monthly sales record entries</div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Monthly Sales Summary</h3>
              <p>Calculated from saved daily invoices.</p>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Number of Invoices</th>
                  <th>Total Sales</th>
                  <th>Total Profit</th>
                </tr>
              </thead>
              <tbody>
                ${
                  Object.keys(grouped).length
                    ? Object.entries(grouped)
                        .map(
                          ([month, info]) => `
                    <tr>
                      <td><strong>${escapeHtml(month)}</strong></td>
                      <td>${info.count}</td>
                      <td>${money(info.sales)}</td>
                      <td>${money(info.profit)}</td>
                    </tr>
                  `
                        )
                        .join("")
                    : `<tr><td colspan="4"><div class="empty">No monthly sales data yet.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Invoice Records</h3>
              <p>Saved invoice history with editable actions.</p>
            </div>
            <span class="pill">${rows.length} invoice(s)</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Profit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map(
                          (inv) => `
                    <tr>
                      <td>${escapeHtml(inv.invoiceNo)}</td>
                      <td>${escapeHtml(inv.date)}</td>
                      <td>${escapeHtml(inv.customerName || "Walk-in Customer")}</td>
                      <td>${inv.items.length}</td>
                      <td>${money(inv.total)}</td>
                      <td>${money(inv.profit)}</td>
                      <td>
                        <div class="row-actions">
                          <button class="btn" data-edit-invoice="${inv.id}">Edit</button>
                          <button class="btn danger" data-del-invoice="${inv.id}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `
                        )
                        .join("")
                    : `<tr><td colspan="7"><div class="empty">No invoices saved yet.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header">
          <div>
            <h3>Printable Monthly Sales Report</h3>
            <p>Select a month and print a report with that month and year.</p>
          </div>
        </div>

        <div class="report-actions">
          <select id="salesMonthSelect" class="btn" style="padding-right:34px;">
            ${
              monthOptions.length
                ? monthOptions
                    .map(
                      (m) => `<option ${m === selected ? "selected" : ""}>${escapeHtml(m)}</option>`
                    )
                    .join("")
                : `<option>No data</option>`
            }
          </select>
          <button class="btn primary" id="printSalesReportBtn">Print Monthly Report</button>
        </div>

        <div id="monthlyReportArea" class="report-print-area">
          ${
            selectedData
              ? `
            <div class="report-head">
              <div>
                <div class="report-title">CresscoX Monthly Sales Report</div>
                <div>${escapeHtml(selected)}</div>
              </div>
              <div style="text-align:right;">
                <div><strong>Invoices:</strong> ${selectedData.count}</div>
                <div><strong>Total Sales:</strong> ${money(selectedData.sales)}</div>
                <div><strong>Total Profit:</strong> ${money(selectedData.profit)}</div>
              </div>
            </div>

            <div class="table-wrap" style="margin-top:0;">
              <table>
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  ${selectedData.invoices
                    .map(
                      (inv) => `
                    <tr>
                      <td>${escapeHtml(inv.invoiceNo)}</td>
                      <td>${escapeHtml(inv.date)}</td>
                      <td>${escapeHtml(inv.customerName || "Walk-in Customer")}</td>
                      <td>${inv.items.length}</td>
                      <td>${money(inv.total)}</td>
                      <td>${money(inv.profit)}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
              : `<div class="empty">No monthly report data available.</div>`
          }
        </div>
      </div>
    `;

    document.getElementById("salesMonthSelect")?.addEventListener("change", (e) => {
      state.selectedSalesMonth = e.target.value;
      saveUiState();
      renderSales();
    });

    document.getElementById("printSalesReportBtn")?.addEventListener("click", () => {
      const area = document.getElementById("monthlyReportArea");
      if (!area) return;
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.open();
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Monthly Sales Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background: #f5f5f5; }
            </style>
          </head>
          <body>${area.innerHTML}</body>
        </html>
      `);
      win.document.close();
      win.focus();
      win.print();
    });

    document.querySelectorAll("[data-edit-invoice]").forEach((btn) => {
      btn.addEventListener("click", () => loadInvoiceForEdit(btn.dataset.editInvoice));
    });

    document.querySelectorAll("[data-del-invoice]").forEach((btn) => {
      btn.addEventListener("click", () => deleteInvoice(btn.dataset.delInvoice));
    });
  }

  async function exportData() {
    try {
      await loadAllDataFromServer();

      const exportState = normalizeState({
        company: state.company,
        customers: state.customers,
        inventory: state.inventory,
        purchases: state.purchases,
        invoices: state.invoices,
      });

      const blob = new Blob([JSON.stringify(exportState, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cresscox-workspace-backup-${today()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert(error.message || "Failed to export data.");
    }
  }

  function importData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const nextState = normalizeState(parsed);

        await replaceWorkspaceDataOnServer(nextState);
        currentInvoiceItems = [];
        renderAll();
        alert("Data imported successfully.");
      } catch (error) {
        console.error("Import failed:", error);
        alert(error.message || "Invalid JSON file or import failed.");
      }
    };
    reader.readAsText(file);
  }

  async function loadDemo() {
    if (!confirm("Replace current workspace data with demo data?")) return;

    try {
      const demo = seedState();
      await replaceWorkspaceDataOnServer(demo);
      currentInvoiceItems = [];
      renderAll();
      alert("Demo data loaded into this workspace.");
    } catch (error) {
      console.error("Load demo failed:", error);
      alert(error.message || "Failed to load demo data.");
    }
  }

  async function clearAll() {
    if (!confirm("Clear all saved ERP data for this workspace? This cannot be undone.")) return;

    try {
      await clearWorkspaceDataOnServer();
      currentInvoiceItems = [];
      state.customerEditId = null;
      state.inventoryEditId = null;
      state.purchaseEditId = null;
      state.invoiceEditId = null;
      saveUiState();
      renderAll();
      alert("Workspace data cleared successfully.");
    } catch (error) {
      console.error("Clear all failed:", error);
      alert(error.message || "Failed to clear workspace data.");
    }
  }

  function bindTopEvents() {
    if (topEventsBound) return;

    document.getElementById("globalSearch")?.addEventListener("input", () => {
      renderAll();
    });

    document.getElementById("exportBtn")?.addEventListener("click", exportData);
    document.getElementById("seedBtn")?.addEventListener("click", loadDemo);
    document.getElementById("resetBtn")?.addEventListener("click", clearAll);
    document.getElementById("logoutBtn")?.addEventListener("click", logout);

    document.getElementById("importFile")?.addEventListener("change", (event) => {
      importData(event.target.files?.[0]);
      event.target.value = "";
    });

    topEventsBound = true;
  }

  function renderAll() {
    if (!state) return;

    renderNav();
    setHeader();
    renderDashboard();
    renderCustomers();
    renderInventory();
    renderPurchasing();
    renderSales();
    renderInvoice();
  }

  async function init() {
    state = loadUiState();
    bindTopEvents();

    try {
      await loadAllDataFromServer();
    } catch (error) {
      console.error("Workspace load failed:", error);
      alert(`Workspace load failed: ${error.message}`);
      return;
    }

    renderAll();

    window.switchPage = switchPage;
    window.removeInvoiceItem = removeInvoiceItem;
    window.renderAll = renderAll;
  }

  document.addEventListener("DOMContentLoaded", init);
})();