const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

function init() {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin', -- admin | customer
      full_name TEXT,
      phone TEXT,
      wilaya TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_dzd INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT, -- nullable for guests
      customer_name TEXT NOT NULL,
      wilaya TEXT NOT NULL,
      phone TEXT,
      service_id TEXT,
      service_name_snapshot TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new', -- new | contacted | done | canceled
      amount_dzd INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT, -- ccp | bank | cash
      payment_ref TEXT,
      is_paid INTEGER NOT NULL DEFAULT 0,
      paid_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(service_id) REFERENCES services(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  `);

  // Lightweight migrations for older DBs:
  const cols = db.prepare(`PRAGMA table_info(users)`).all().map(r=>r.name);
  const addCol = (table, col, def) => { try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch(e) {} };
  if(!cols.includes("full_name")) addCol("users","full_name","TEXT");
  if(!cols.includes("phone")) addCol("users","phone","TEXT");
  if(!cols.includes("wilaya")) addCol("users","wilaya","TEXT");

  const ocols = db.prepare(`PRAGMA table_info(orders)`).all().map(r=>r.name);
  if(!ocols.includes("user_id")) addCol("orders","user_id","TEXT");
  if(!ocols.includes("amount_dzd")) addCol("orders","amount_dzd","INTEGER NOT NULL DEFAULT 0");
  if(!ocols.includes("payment_method")) addCol("orders","payment_method","TEXT");
  if(!ocols.includes("payment_ref")) addCol("orders","payment_ref","TEXT");
  if(!ocols.includes("is_paid")) addCol("orders","is_paid","INTEGER NOT NULL DEFAULT 0");
  if(!ocols.includes("paid_at")) addCol("orders","paid_at","TEXT");
}

module.exports = { db, init };
