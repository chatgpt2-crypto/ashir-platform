const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== إعدادات ======
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// Admin login (غيّرهم من Render Environment لاحقًا)
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "123456";

// رقم واتساب (غيّره من Render Environment)
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "213666376417";

// ====== مساعدات ======
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf8");
}

function readOrders() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeOrders(orders) {
  ensureStorage();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf8");
}

function basicAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(h.replace("Basic ", ""), "base64").toString("utf8");
  const [u, p] = decoded.split(":");
  if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  res.set("WWW-Authenticate", 'Basic realm="Admin"');
  return res.status(401).send("Wrong credentials");
}

// ====== Middleware ======
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ====== API ======

// إنشاء طلب جديد
app.post("/api/orders", (req, res) => {
  try {
    const { name, phone, service, note } = req.body || {};

    if (!name || !phone || !service) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const orders = readOrders();
    const order = {
      id: Date.now().toString(),
      name: String(name).trim(),
      phone: String(phone).trim(),
      service: String(service).trim(),
      note: note ? String(note).trim() : "",
      createdAt: new Date().toISOString()
    };

    orders.unshift(order);
    writeOrders(orders);

    // رجّع أيضًا رابط واتساب جاهز (بدون Meta)
    const msg =
      `طلب جديد من منصة أشير\n` +
      `الاسم: ${order.name}\n` +
      `الهاتف: ${order.phone}\n` +
      `الخدمة: ${order.service}\n` +
      (order.note ? `ملاحظة: ${order.note}\n` : "") +
      `الوقت: ${order.createdAt}`;

    const waLink =
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

    return res.json({ ok: true, order, waLink });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// جلب كل الطلبات (محمي)
app.get("/api/admin/orders", basicAuth, (req, res) => {
  const orders = readOrders();
  res.json({ ok: true, orders });
});

// صفحة لوحة الإدارة (محمي) - يفتح dashboard.html
app.get("/admin", basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Health
app.get("/health", (req, res) => res.send("OK"));

app.listen(PORT, () => {
  ensureStorage();
  console.log("Server running on port " + PORT);
});
