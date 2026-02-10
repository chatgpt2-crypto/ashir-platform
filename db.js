const Database = require("better-sqlite3");

const db = new Database("data.sqlite");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
email TEXT UNIQUE,
password TEXT,
role TEXT
);

CREATE TABLE IF NOT EXISTS orders (
id TEXT PRIMARY KEY,
name TEXT,
phone TEXT,
service TEXT,
created_at TEXT
);
`);

module.exports = db;
