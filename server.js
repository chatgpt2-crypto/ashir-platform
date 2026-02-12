const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ====== إعدادات ======
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "213666376417").replace(/\D/g, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin12345!";

const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([] , null, 2), "utf-8");
}
ensureDataFile();

function readOrders() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8"));
}
function writeOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

// ====== Middleware ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ashir_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ====== صفحات ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ====== تسجيل دخول الإدارة ======
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect("/admin");
  }
  return res.redirect("/login?err=1");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/login");
}

// ====== لوحة الإدارة ======
app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/admin/api/orders", requireAdmin, (req, res) => {
  const orders = readOrders().reverse(); // الأحدث أولاً
  res.json({ ok: true, orders });
});

// ====== API استقبال الطلب ======
app.post("/api/order", (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const phone = (req.body.phone || "").trim();
    const service = (req.body.service || "").trim();
    const note = (req.body.note || "").trim();

    if (!name || !phone || !service) {
      return res.status(400).json({ ok: false, message: "الاسم + الهاتف + الخدمة مطلوبة" });
    }

    const orders = readOrders();
    const order = {
      id: Date.now().toString(),
      name,
      phone,
      service,
      note,
      createdAt: new Date().toISOString()
    };
    orders.push(order);
    writeOrders(orders);

    // رابط واتساب “بدون Meta” = فتح محادثة مع رسالة جاهزة
    const msg =
      `طلب جديد من منصة أشير:%0A` +
      `الاسم: ${encodeURIComponent(name)}%0A` +
      `الهاتف: ${encodeURIComponent(phone)}%0A` +
      `الخدمة: ${encodeURIComponent(service)}%0A` +
      `ملاحظة: ${encodeURIComponent(note || "-")}%0A` +
      `رقم الطلب: ${order.id}`;

    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;

    return res.json({ ok: true, waLink, order });
  } catch (e) {
    return res.status(500).json({ ok: false, message: "تعذر حفظ الطلب في السيرفر" });
  }
});

app.listen(PORT, () => console.log("Server running on port:", PORT));
