const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.set("trust proxy", 1); // مهم على Render

const PORT = process.env.PORT || 3000;

// ===== إعدادات الأدمن (غيّرها لاحقاً من Environment Variables في Render) =====
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123"; // غيّرها فوراً

// ===== ملف التخزين (على Render قد يرجع فاضي بعد إعادة النشر) =====
const DATA_FILE = path.join(__dirname, "orders.json");

// إنشاء ملف إذا غير موجود
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]), "utf8");
}

function readOrders() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (e) {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), "utf8");
}

// ===== Middlewares =====
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ===== حماية بسيطة للوحة الإدارة =====
function basicAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Auth required");
  }
  const base64 = auth.split(" ")[1];
  const [user, pass] = Buffer.from(base64, "base64").toString().split(":");
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader("WWW-Authenticate", 'Basic realm="Admin"');
  return res.status(401).send("Wrong credentials");
}

// ===== API =====

// حفظ طلب جديد
app.post("/api/order", (req, res) => {
  const { name, phone, service, note } = req.body || {};

  if (!name || !phone || !service) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const orders = readOrders();
  const order = {
    id: Date.now().toString(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    service: String(service).trim(),
    note: String(note || "").trim(),
    date: new Date().toLocaleString("ar-DZ")
  };

  orders.push(order);
  writeOrders(orders);

  res.json({ success: true, order });
});

// جلب الطلبات (للداشبورد)
app.get("/api/orders", basicAuth, (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// صفحة الداشبورد محمية
app.get("/dashboard.html", basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
