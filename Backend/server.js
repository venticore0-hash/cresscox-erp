/*
CresscoX ERP - Node.js backend starter

What this solves from your 6 problems:
1. No Device Syncing -> shared server + database
2. Data Deletion Risk -> data stored on server, not browser localStorage
3. No Real-time Collaboration -> multiple users can log into same workspace/company
4. Storage Limits -> SQLite database on server instead of browser storage
5. Zero Data Privacy -> login, hashed passwords, protected API routes
6. No Automatic Backups -> backup endpoints + restore endpoint + audit log

How to use:
1. Create a new folder called backend
2. Save this file as: server.js
3. Run:
   npm init -y
   npm install express cors bcryptjs jsonwebtoken better-sqlite3 multer
4. Start:
   node server.js

Frontend connection:
- Your current HTML index file can call this backend with fetch().
- Default server URL in this file: http://localhost:4000

Important note:
- This is the Node.js part only.
- After this, your frontend HTML must be changed to save/load data from these APIs.
- For live use, you will later deploy this backend to a server.
*/


require('dotenv').config();
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..')));
const JWT_SECRET = process.env.JWT_SECRET || 'replace-this-with-a-strong-secret';
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'cresscox.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });


const nodemailer = require('nodemailer');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


console.log("GOOGLE_CLIENT_ID from env:", GOOGLE_CLIENT_ID);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';



app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = (payload.email || '').trim().toLowerCase();
    const fullName = (payload.name || 'Google User').trim();
    const emailVerified = !!payload.email_verified;

    if (!email) {
      return res.status(400).json({ error: 'Google account email not found' });
    }

    if (!emailVerified) {
      return res.status(400).json({ error: 'Google email is not verified' });
    }

    let user = db.prepare(`
      SELECT * FROM users
      WHERE email = ?
    `).get(email);

    let workspaceId = null;

    if (!user) {
      const tx = db.transaction(() => {
        const userResult = db.prepare(`
          INSERT INTO users (
            full_name,
            email,
            password_hash,
            role,
            google_id,
            is_verified,
            verification_token
          )
          VALUES (?, ?, ?, 'admin', ?, 1, NULL)
        `).run(fullName, email, '', googleId);

        const userId = userResult.lastInsertRowid;

        const workspaceResult = db.prepare(`
          INSERT INTO workspaces (name, owner_user_id)
          VALUES (?, ?)
        `).run(`${fullName}'s Workspace`, userId);

        workspaceId = workspaceResult.lastInsertRowid;

        db.prepare(`
          INSERT INTO workspace_members (workspace_id, user_id, member_role)
          VALUES (?, ?, 'admin')
        `).run(workspaceId, userId);
      });

      tx();

      user = db.prepare(`
        SELECT * FROM users
        WHERE email = ?
      `).get(email);
    } else {
      db.prepare(`
        UPDATE users
        SET google_id = ?, is_verified = 1
        WHERE id = ?
      `).run(googleId, user.id);

      const membership = db.prepare(`
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = ?
        LIMIT 1
      `).get(user.id);

      workspaceId = membership ? membership.workspace_id : null;
    }

    if (!workspaceId) {
      const membership = db.prepare(`
        SELECT workspace_id
        FROM workspace_members
        WHERE user_id = ?
        LIMIT 1
      `).get(user.id);

      workspaceId = membership ? membership.workspace_id : null;
    }

    const token = generateToken(user);

    return res.json({
      message: 'Google login successful',
      token,
      workspaceId,
      user: {
        email,
        fullName,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(401).json({ error: 'Invalid Google credential' });
  }
});

function initDb() {
  db.exec(`
   CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  google_id TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
    
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workspace_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      member_role TEXT NOT NULL DEFAULT 'admin',
      UNIQUE(workspace_id, user_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      minimum_qty REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, item_code),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      purchase_date TEXT NOT NULL,
      supplier TEXT,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      invoice_no TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      customer_address TEXT,
      total REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(workspace_id, invoice_no),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      line_profit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

initDb();

function logAudit({ workspaceId = null, userId = null, action, entityType, entityId = null, details = null }) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (workspace_id, user_id, action, entity_type, entity_id, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(workspaceId, userId, action, entityType, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null);
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = header.slice(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireWorkspaceAccess(req, res, next) {
  const workspaceId = Number(req.params.workspaceId || req.body.workspaceId || req.query.workspaceId);
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }

  const membership = db.prepare(`
    SELECT * FROM workspace_members
    WHERE workspace_id = ? AND user_id = ?
  `).get(workspaceId, req.user.userId);

  if (!membership) {
    return res.status(403).json({ error: 'No access to this workspace' });
  }

  req.workspaceId = workspaceId;
  req.membership = membership;
  next();
}

function recalculateInventory(workspaceId) {
  const items = db.prepare(`
    SELECT id, item_code, minimum_qty, sale_price, cost_price, item_name
    FROM inventory_items WHERE workspace_id = ?
  `).all(workspaceId);

  const map = new Map();
  for (const item of items) {
    map.set(item.item_code.toLowerCase(), {
      ...item,
      current_stock: 0,
    });
  }

  const purchases = db.prepare(`
    SELECT item_code, item_name, quantity, cost_price
    FROM purchases WHERE workspace_id = ?
  `).all(workspaceId);

  for (const p of purchases) {
    const key = p.item_code.toLowerCase();
    if (!map.has(key)) {
      const insert = db.prepare(`
        INSERT INTO inventory_items
        (workspace_id, item_code, item_name, current_stock, minimum_qty, sale_price, cost_price)
        VALUES (?, ?, ?, 0, 0, 0, ?)
      `);
      const result = insert.run(workspaceId, p.item_code, p.item_name, p.cost_price || 0);
      map.set(key, {
        id: result.lastInsertRowid,
        item_code: p.item_code,
        item_name: p.item_name,
        minimum_qty: 0,
        sale_price: 0,
        cost_price: p.cost_price || 0,
        current_stock: 0,
      });
    }
    const item = map.get(key);
    item.current_stock += Number(p.quantity || 0);
    item.cost_price = Number(p.cost_price || item.cost_price || 0);
  }

  const invoiceLines = db.prepare(`
    SELECT ii.item_code, ii.quantity
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.workspace_id = ?
  `).all(workspaceId);

  for (const line of invoiceLines) {
    const key = line.item_code.toLowerCase();
    if (map.has(key)) {
      map.get(key).current_stock -= Number(line.quantity || 0);
    }
  }

  const update = db.prepare(`
    UPDATE inventory_items
    SET current_stock = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    for (const item of map.values()) {
      update.run(item.current_stock, item.cost_price || 0, item.id);
    }
  });
  tx();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'CresscoX backend running' });
});

// AUTH
app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, workspaceName } = req.body;

  if (!fullName || !email || !password || !workspaceName) {
    return res.status(400).json({ error: 'fullName, email, password, workspaceName are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const tx = db.transaction(() => {
    const userResult = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run(fullName.trim(), email.trim().toLowerCase(), passwordHash);

    const userId = userResult.lastInsertRowid;

    const workspaceResult = db.prepare(`
      INSERT INTO workspaces (name, owner_user_id)
      VALUES (?, ?)
    `).run(workspaceName.trim(), userId);

    const workspaceId = workspaceResult.lastInsertRowid;

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, member_role)
      VALUES (?, ?, 'admin')
    `).run(workspaceId, userId);

    logAudit({
      workspaceId,
      userId,
      action: 'create',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { workspaceName },
    });

    return { userId, workspaceId };
  });

  const result = tx();
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(result.userId);
  const token = generateToken(user);

  res.status(201).json({
    message: 'Registered successfully',
    token,
    user,
    workspaceId: result.workspaceId,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const memberships = db.prepare(`
    SELECT wm.workspace_id, wm.member_role, w.name AS workspace_name
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
  `).all(user.id);

  const token = generateToken(user);

  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name },
    workspaces: memberships,
  });
});

app.get('/api/workspaces', auth, (req, res) => {
  const workspaces = db.prepare(`
    SELECT wm.workspace_id, wm.member_role, w.name AS workspace_name
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
  `).all(req.user.userId);

  res.json(workspaces);
});

// CUSTOMERS
app.get('/api/workspaces/:workspaceId/customers', auth, requireWorkspaceAccess, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM customers
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(req.workspaceId);
  res.json(rows);
});

app.post('/api/workspaces/:workspaceId/customers', auth, requireWorkspaceAccess, (req, res) => {
  const { name, phone = '', email = '', address = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db.prepare(`
    INSERT INTO customers (workspace_id, name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.workspaceId, name, phone, email, address, notes);

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'create',
    entityType: 'customer',
    entityId: result.lastInsertRowid,
    details: { name },
  });

  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/workspaces/:workspaceId/customers/:id', auth, requireWorkspaceAccess, (req, res) => {
  const { name, phone = '', email = '', address = '', notes = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  db.prepare(`
    UPDATE customers
    SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(name, phone, email, address, notes, req.params.id, req.workspaceId);

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'update',
    entityType: 'customer',
    entityId: req.params.id,
    details: { name },
  });

  res.json({ ok: true });
});

app.delete('/api/workspaces/:workspaceId/customers/:id', auth, requireWorkspaceAccess, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId);

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'delete',
    entityType: 'customer',
    entityId: req.params.id,
  });

  res.json({ ok: true });
});

// INVENTORY
app.get('/api/workspaces/:workspaceId/inventory', auth, requireWorkspaceAccess, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM inventory_items
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(req.workspaceId);
  res.json(rows);
});

app.post('/api/workspaces/:workspaceId/inventory', auth, requireWorkspaceAccess, (req, res) => {
  const {
    itemCode,
    itemName,
    currentStock = 0,
    minimumQty = 0,
    salePrice = 0,
    costPrice = 0,
  } = req.body;

  if (!itemCode || !itemName) {
    return res.status(400).json({ error: 'itemCode and itemName are required' });
  }

  const result = db.prepare(`
    INSERT INTO inventory_items
    (workspace_id, item_code, item_name, current_stock, minimum_qty, sale_price, cost_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.workspaceId,
    itemCode,
    itemName,
    Number(currentStock || 0),
    Number(minimumQty || 0),
    Number(salePrice || 0),
    Number(costPrice || 0)
  );

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'create',
    entityType: 'inventory_item',
    entityId: result.lastInsertRowid,
    details: { itemCode, itemName },
  });

  res.status(201).json({ id: result.lastInsertRowid });
});

app.put('/api/workspaces/:workspaceId/inventory/:id', auth, requireWorkspaceAccess, (req, res) => {
  const {
    itemCode,
    itemName,
    currentStock = 0,
    minimumQty = 0,
    salePrice = 0,
    costPrice = 0,
  } = req.body;

  db.prepare(`
    UPDATE inventory_items
    SET item_code = ?, item_name = ?, current_stock = ?, minimum_qty = ?, sale_price = ?, cost_price = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(
    itemCode,
    itemName,
    Number(currentStock || 0),
    Number(minimumQty || 0),
    Number(salePrice || 0),
    Number(costPrice || 0),
    req.params.id,
    req.workspaceId
  );

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'update',
    entityType: 'inventory_item',
    entityId: req.params.id,
    details: { itemCode, itemName },
  });

  res.json({ ok: true });
});

app.delete('/api/workspaces/:workspaceId/inventory/:id', auth, requireWorkspaceAccess, (req, res) => {
  db.prepare('DELETE FROM inventory_items WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId);

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'delete',
    entityType: 'inventory_item',
    entityId: req.params.id,
  });

  res.json({ ok: true });
});

// PURCHASES
app.get('/api/workspaces/:workspaceId/purchases', auth, requireWorkspaceAccess, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM purchases
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(req.workspaceId);
  res.json(rows);
});

app.post('/api/workspaces/:workspaceId/purchases', auth, requireWorkspaceAccess, (req, res) => {
  const {
    purchaseDate,
    supplier = '',
    itemCode,
    itemName,
    quantity,
    costPrice = 0,
    note = '',
  } = req.body;

  if (!purchaseDate || !itemCode || !itemName || !quantity) {
    return res.status(400).json({ error: 'purchaseDate, itemCode, itemName, quantity are required' });
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO purchases
      (workspace_id, purchase_date, supplier, item_code, item_name, quantity, cost_price, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.workspaceId,
      purchaseDate,
      supplier,
      itemCode,
      itemName,
      Number(quantity),
      Number(costPrice || 0),
      note
    );

    const existing = db.prepare(`
      SELECT id FROM inventory_items WHERE workspace_id = ? AND item_code = ?
    `).get(req.workspaceId, itemCode);

    if (!existing) {
      db.prepare(`
        INSERT INTO inventory_items (workspace_id, item_code, item_name, current_stock, minimum_qty, sale_price, cost_price)
        VALUES (?, ?, ?, 0, 0, 0, ?)
      `).run(req.workspaceId, itemCode, itemName, Number(costPrice || 0));
    }

    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'create',
    entityType: 'purchase',
    details: { itemCode, itemName, quantity },
  });

  res.status(201).json({ ok: true });
});

app.put('/api/workspaces/:workspaceId/purchases/:id', auth, requireWorkspaceAccess, (req, res) => {
  const {
    purchaseDate,
    supplier = '',
    itemCode,
    itemName,
    quantity,
    costPrice = 0,
    note = '',
  } = req.body;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE purchases
      SET purchase_date = ?, supplier = ?, item_code = ?, item_name = ?, quantity = ?, cost_price = ?, note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND workspace_id = ?
    `).run(
      purchaseDate,
      supplier,
      itemCode,
      itemName,
      Number(quantity),
      Number(costPrice || 0),
      note,
      req.params.id,
      req.workspaceId
    );

    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'update',
    entityType: 'purchase',
    entityId: req.params.id,
    details: { itemCode, itemName, quantity },
  });

  res.json({ ok: true });
});

app.delete('/api/workspaces/:workspaceId/purchases/:id', auth, requireWorkspaceAccess, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM purchases WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId);
    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'delete',
    entityType: 'purchase',
    entityId: req.params.id,
  });

  res.json({ ok: true });
});

// INVOICES
app.get('/api/workspaces/:workspaceId/invoices', auth, requireWorkspaceAccess, (req, res) => {
  const invoices = db.prepare(`
    SELECT * FROM invoices
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(req.workspaceId);

  const invoiceItemsStmt = db.prepare(`
    SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC
  `);

  const data = invoices.map(inv => ({
    ...inv,
    items: invoiceItemsStmt.all(inv.id),
  }));

  res.json(data);
});

app.post('/api/workspaces/:workspaceId/invoices', auth, requireWorkspaceAccess, (req, res) => {
  const {
    invoiceNo,
    invoiceDate,
    customerName = '',
    customerPhone = '',
    customerAddress = '',
    items = [],
  } = req.body;

  if (!invoiceNo || !invoiceDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invoiceNo, invoiceDate and items are required' });
  }

  const total = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const profit = items.reduce((sum, item) => sum + Number(item.lineProfit || 0), 0);

  const tx = db.transaction(() => {
    const invoiceResult = db.prepare(`
      INSERT INTO invoices
      (workspace_id, invoice_no, invoice_date, customer_name, customer_phone, customer_address, total, profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.workspaceId,
      invoiceNo,
      invoiceDate,
      customerName,
      customerPhone,
      customerAddress,
      total,
      profit
    );

    const invoiceId = invoiceResult.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, item_code, item_name, quantity, price, cost_price, line_total, line_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        invoiceId,
        item.itemCode,
        item.itemName,
        Number(item.quantity || 0),
        Number(item.price || 0),
        Number(item.costPrice || 0),
        Number(item.lineTotal || 0),
        Number(item.lineProfit || 0)
      );
    }

    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'create',
    entityType: 'invoice',
    details: { invoiceNo, total, profit },
  });

  res.status(201).json({ ok: true });
});

app.put('/api/workspaces/:workspaceId/invoices/:id', auth, requireWorkspaceAccess, (req, res) => {
  const {
    invoiceNo,
    invoiceDate,
    customerName = '',
    customerPhone = '',
    customerAddress = '',
    items = [],
  } = req.body;

  const total = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const profit = items.reduce((sum, item) => sum + Number(item.lineProfit || 0), 0);

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE invoices
      SET invoice_no = ?, invoice_date = ?, customer_name = ?, customer_phone = ?, customer_address = ?, total = ?, profit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND workspace_id = ?
    `).run(
      invoiceNo,
      invoiceDate,
      customerName,
      customerPhone,
      customerAddress,
      total,
      profit,
      req.params.id,
      req.workspaceId
    );

    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, item_code, item_name, quantity, price, cost_price, line_total, line_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        req.params.id,
        item.itemCode,
        item.itemName,
        Number(item.quantity || 0),
        Number(item.price || 0),
        Number(item.costPrice || 0),
        Number(item.lineTotal || 0),
        Number(item.lineProfit || 0)
      );
    }

    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'update',
    entityType: 'invoice',
    entityId: req.params.id,
    details: { invoiceNo, total, profit },
  });

  res.json({ ok: true });
});

app.delete('/api/workspaces/:workspaceId/invoices/:id', auth, requireWorkspaceAccess, (req, res) => {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM invoices WHERE id = ? AND workspace_id = ?').run(req.params.id, req.workspaceId);
    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'delete',
    entityType: 'invoice',
    entityId: req.params.id,
  });

  res.json({ ok: true });
});

// FULL WORKSPACE DATA
function getWorkspaceFullData(workspaceId) {
  const company = {
    name: 'CresscoX',
    address: '17 Market Street, Berlin',
    phone: '+49 30 000000',
    email: 'sales@cresscox.com',
  };

  const customers = db.prepare(`
    SELECT id, name, phone, email, address, notes
    FROM customers
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(workspaceId);

  const inventory = db.prepare(`
    SELECT
      id,
      item_code AS itemCode,
      item_name AS itemName,
      current_stock AS currentStock,
      minimum_qty AS minimumQty,
      sale_price AS salePrice,
      cost_price AS costPrice
    FROM inventory_items
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(workspaceId);

  const purchases = db.prepare(`
    SELECT
      id,
      purchase_date AS date,
      supplier,
      item_code AS itemCode,
      item_name AS itemName,
      quantity,
      cost_price AS costPrice,
      note
    FROM purchases
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(workspaceId);

  const invoices = db.prepare(`
    SELECT
      id,
      invoice_no AS invoiceNo,
      invoice_date AS date,
      customer_name AS customerName,
      customer_phone AS customerPhone,
      customer_address AS customerAddress,
      total,
      profit
    FROM invoices
    WHERE workspace_id = ?
    ORDER BY id DESC
  `).all(workspaceId);

  const invoiceItemsStmt = db.prepare(`
    SELECT
      id,
      item_code AS itemCode,
      item_name AS itemName,
      quantity,
      price,
      cost_price AS costPrice,
      line_total AS lineTotal,
      line_profit AS lineProfit
    FROM invoice_items
    WHERE invoice_id = ?
    ORDER BY id ASC
  `);

  const invoicesWithItems = invoices.map((inv) => ({
    ...inv,
    items: invoiceItemsStmt.all(inv.id),
  }));

  return {
    company,
    customers,
    inventory,
    purchases,
    invoices: invoicesWithItems,
  };
}

app.get('/api/workspaces/:workspaceId/full-data', auth, requireWorkspaceAccess, (req, res) => {
  const data = getWorkspaceFullData(req.workspaceId);
  res.json(data);
});

app.put('/api/workspaces/:workspaceId/full-data', auth, requireWorkspaceAccess, (req, res) => {
  const payload = req.body || {};
  const customers = Array.isArray(payload.customers) ? payload.customers : [];
  const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const invoices = Array.isArray(payload.invoices) ? payload.invoices : [];

  const tx = db.transaction(() => {
    const invoiceIds = db.prepare(`
      SELECT id FROM invoices WHERE workspace_id = ?
    `).all(req.workspaceId).map((row) => row.id);

    if (invoiceIds.length) {
      const deleteInvoiceItems = db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`);
      for (const invoiceId of invoiceIds) {
        deleteInvoiceItems.run(invoiceId);
      }
    }

    db.prepare(`DELETE FROM invoices WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM purchases WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM inventory_items WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM customers WHERE workspace_id = ?`).run(req.workspaceId);

    const insertCustomer = db.prepare(`
      INSERT INTO customers (workspace_id, name, phone, email, address, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const row of customers) {
      insertCustomer.run(
        req.workspaceId,
        String(row.name || '').trim(),
        String(row.phone || '').trim(),
        String(row.email || '').trim(),
        String(row.address || '').trim(),
        String(row.notes || '').trim()
      );
    }

    const insertInventory = db.prepare(`
      INSERT INTO inventory_items
      (workspace_id, item_code, item_name, current_stock, minimum_qty, sale_price, cost_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of inventory) {
      insertInventory.run(
        req.workspaceId,
        String(row.itemCode || row.item_code || '').trim(),
        String(row.itemName || row.item_name || '').trim(),
        Number(row.currentStock ?? row.current_stock ?? 0),
        Number(row.minimumQty ?? row.minimum_qty ?? 0),
        Number(row.salePrice ?? row.sale_price ?? 0),
        Number(row.costPrice ?? row.cost_price ?? 0)
      );
    }

    const insertPurchase = db.prepare(`
      INSERT INTO purchases
      (workspace_id, purchase_date, supplier, item_code, item_name, quantity, cost_price, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of purchases) {
      insertPurchase.run(
        req.workspaceId,
        row.date || row.purchaseDate || row.purchase_date || new Date().toISOString().slice(0, 10),
        String(row.supplier || '').trim(),
        String(row.itemCode || row.item_code || '').trim(),
        String(row.itemName || row.item_name || '').trim(),
        Number(row.quantity || 0),
        Number(row.costPrice ?? row.cost_price ?? 0),
        String(row.note || '').trim()
      );
    }

    const insertInvoice = db.prepare(`
      INSERT INTO invoices
      (workspace_id, invoice_no, invoice_date, customer_name, customer_phone, customer_address, total, profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertInvoiceItem = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, item_code, item_name, quantity, price, cost_price, line_total, line_profit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const inv of invoices) {
      const items = Array.isArray(inv.items) ? inv.items : [];
      const total = items.reduce((sum, item) => sum + Number(item.lineTotal || item.line_total || 0), 0);
      const profit = items.reduce((sum, item) => sum + Number(item.lineProfit || item.line_profit || 0), 0);

      const invoiceResult = insertInvoice.run(
        req.workspaceId,
        String(inv.invoiceNo || inv.invoice_no || '').trim(),
        inv.date || inv.invoiceDate || inv.invoice_date || new Date().toISOString().slice(0, 10),
        String(inv.customerName || inv.customer_name || '').trim(),
        String(inv.customerPhone || inv.customer_phone || '').trim(),
        String(inv.customerAddress || inv.customer_address || '').trim(),
        total,
        profit
      );

      for (const item of items) {
        insertInvoiceItem.run(
          invoiceResult.lastInsertRowid,
          String(item.itemCode || item.item_code || '').trim(),
          String(item.itemName || item.item_name || '').trim(),
          Number(item.quantity || 0),
          Number(item.price || 0),
          Number(item.costPrice ?? item.cost_price ?? 0),
          Number(item.lineTotal || item.line_total || 0),
          Number(item.lineProfit || item.line_profit || 0)
        );
      }
    }

    recalculateInventory(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'replace',
    entityType: 'workspace_data',
  });

  res.json({ ok: true });
});

app.delete('/api/workspaces/:workspaceId/full-data', auth, requireWorkspaceAccess, (req, res) => {
  const tx = db.transaction(() => {
    const invoiceIds = db.prepare(`
      SELECT id FROM invoices WHERE workspace_id = ?
    `).all(req.workspaceId).map((row) => row.id);

    if (invoiceIds.length) {
      const deleteInvoiceItems = db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`);
      for (const invoiceId of invoiceIds) {
        deleteInvoiceItems.run(invoiceId);
      }
    }

    db.prepare(`DELETE FROM invoices WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM purchases WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM inventory_items WHERE workspace_id = ?`).run(req.workspaceId);
    db.prepare(`DELETE FROM customers WHERE workspace_id = ?`).run(req.workspaceId);
  });

  tx();

  logAudit({
    workspaceId: req.workspaceId,
    userId: req.user.userId,
    action: 'clear',
    entityType: 'workspace_data',
  });

  res.json({ ok: true });
});
// REPORTS
app.get('/api/workspaces/:workspaceId/reports/monthly-sales', auth, requireWorkspaceAccess, (req, res) => {
  const rows = db.prepare(`
    SELECT invoice_date, total, profit, invoice_no, customer_name
    FROM invoices
    WHERE workspace_id = ?
    ORDER BY invoice_date DESC, id DESC
  `).all(req.workspaceId);

  const grouped = {};
  for (const row of rows) {
    const monthKey = new Date(row.invoice_date).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        month: monthKey,
        totalSales: 0,
        totalProfit: 0,
        invoices: [],
      };
    }

    grouped[monthKey].totalSales += Number(row.total || 0);
    grouped[monthKey].totalProfit += Number(row.profit || 0);
    grouped[monthKey].invoices.push(row);
  }

  res.json(Object.values(grouped));
});

// BACKUPS
app.post('/api/admin/backup', auth, (req, res) => {
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const backupPath = path.join(BACKUP_DIR, filename);

  fs.copyFileSync(DB_PATH, backupPath);

  logAudit({
    userId: req.user.userId,
    action: 'backup',
    entityType: 'system',
    details: { filename },
  });

  res.json({ ok: true, filename });
});

app.get('/api/admin/backups', auth, (_req, res) => {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(name => name.endsWith('.sqlite'))
    .map(name => ({ name }))
    .sort((a, b) => b.name.localeCompare(a.name));

  res.json(files);
});

app.post('/api/admin/restore', auth, (req, res) => {
  const { filename } = req.body;
  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }

  const backupPath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  db.close();
  fs.copyFileSync(backupPath, DB_PATH);

  logAudit({
    userId: req.user.userId,
    action: 'restore',
    entityType: 'system',
    details: { filename },
  });

  res.json({ ok: true, message: 'Restore complete. Restart server now.' });
});

app.get('/api/workspaces/:workspaceId/audit-logs', auth, requireWorkspaceAccess, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM audit_logs
    WHERE workspace_id = ? OR workspace_id IS NULL
    ORDER BY id DESC
    LIMIT 300
  `).all(req.workspaceId);

  res.json(rows);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'loginregister.html'));
});

app.listen(PORT, () => {
  console.log(`CresscoX backend running on http://localhost:${PORT}`);
});

const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.EMAIL_CLIENT_ID,
    clientSecret: process.env.EMAIL_CLIENT_SECRET,
    refreshToken: process.env.EMAIL_REFRESH_TOKEN,
  },
});
function randomToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

async function sendVerificationEmail(toEmail, fullName, verificationToken) {
  const verifyUrl = `${FRONTEND_URL}/Login%20and%20Register/Loginregister.html?verify=${verificationToken}`;

  await mailTransporter.sendMail({
    from: `"CresscoX ERP" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your CresscoX ERP account',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;">
        <h2>Welcome to CresscoX ERP</h2>
        <p>Hello ${fullName},</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 18px;background:#e11d2e;color:#fff;text-decoration:none;border-radius:8px;">
            Verify Email
          </a>
        </p>
        <p>If the button does not work, copy this link:</p>
        <p>${verifyUrl}</p>
      </div>
    `,
  });
}