const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ====== ENV ======
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "213666376417";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// ====== Storage (File) ======
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function loadOrders() {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveOrders(list) {
  try {
    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to save orders:", e.message);
  }
}

let orders = loadOrders();

// ====== Auth (Basic) ======
function basicAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Admin Panel"');
    return res.status(401).send("Auth required");
  }

  const base64 = header.split(" ")[1];
  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const [user, pass] = decoded.split(":");

  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();

  res.set("WWW-Authenticate", 'Basic realm="Admin Panel"');
  return res.status(401).send("Invalid credentials");
}

// ====== Routes ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// لوحة الإدارة
app.get("/admin", (req, res) => {
  res.redirect("/admin.html");
});

// إنشاء طلب
app.post("/api/order", async (req, res) => {
  try {
    const { name, phone, service, notes } = req.body || {};

    if (!name || !phone || !service) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const order = {
      id: Date.now().toString(),
      name: String(name).trim(),
      phone: String(phone).trim(),
      service: String(service).trim(),
      notes: String(notes || "").trim(),
      time: new Date().toISOString()
    };

    orders.unshift(order);
    saveOrders(orders);

    // رسالة واتساب (بدون Meta API — مجرد فتح رابط واتساب)
    const waText =
      `طلب جديد من منصة أشير:%0A` +
      `الاسم: ${encodeURIComponent(order.name)}%0A` +
      `الهاتف: ${encodeURIComponent(order.phone)}%0A` +
      `الخدمة: ${encodeURIComponent(order.service)}%0A` +
      `ملاحظة: ${encodeURIComponent(order.notes || "-")}%0A` +
      `الوقت: ${encodeURIComponent(order.time)}`;

    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

    // تيليجرام (اختياري)
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        const msg =
          `📩 طلب جديد من منصة أشير\n` +
          `👤 الاسم: ${order.name}\n` +
          `📞 الهاتف: ${order.phone}\n` +
          `🛠 الخدمة: ${order.service}\n` +
          `📝 ملاحظة: ${order.notes || "-"}\n` +
          `⏰ الوقت: ${order.time}`;

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg })
        });
      } catch (e) {
        console.error("Telegram send failed:", e.message);
      }
    }

    return res.json({ ok: true, order, waLink });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// عرض الطلبات (محمي)
app.get("/api/orders", basicAuth, (req, res) => {
  return res.json({ ok: true, orders });
});

// حذف طلب (محمي)
app.delete("/api/orders/:id", basicAuth, (req, res) => {
  const { id } = req.params;
  const before = orders.length;
  orders = orders.filter((o) => o.id !== id);
  if (orders.length !== before) saveOrders(orders);
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("==> Your service is live 🎉");
  console.log("==> Available at your primary URL");
});
