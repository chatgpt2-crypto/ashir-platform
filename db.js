const Database = require("better-sqlite3");

const db = new Database("data.sqlite");

// إنشاء الجداول إذا ماكانوش موجودين
db.exec(`
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_dzd INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new'
);
`);

// خدمات افتراضية
const count = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
if (count === 0) {
  const ins = db.prepare("INSERT INTO services (id,name,price_dzd,active) VALUES (?,?,?,?)");
  ins.run("delivery", "خدمات توصيل", 0, 1);
  ins.run("repair", "صيانة وخدمات", 0, 1);
  ins.run("agri", "خدمات فلاحية", 0, 1);
}

module.exports = db;
