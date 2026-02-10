const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./db");
const { requireAdmin } = require("./auth");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// إعدادات
const SITE_NAME = process.env.SITE_NAME || "منصة أشير";
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "213666376417").replace(/\D/g, "");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "Admin12345!";

// Telegram
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "";

// رابط واتساب مباشر (بدون Meta)
function waLink(text) {
  const msg = encodeURIComponent(text);
  // رقم بدون + وبدون مسافات
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
}

async function sendTelegram(text) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return { ok: false, skipped: true };
  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text })
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: j };
}

// API: قائمة الخدمات
app.get("/api/services", (req, res) => {
  const rows = db.prepare("SELECT id,name,price_dzd,active FROM services WHERE active=1 ORDER BY name").all();
  res.json({ ok: true, services: rows, siteName: SITE_NAME });
});

// API: إنشاء طلب
app.post("/api/order", async (req, res) => {
  try {
    const { customer_name, phone, service_id, note } = req.body || {};
    if (!customer_name || !phone || !service_id) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const service = db.prepare("SELECT id,name FROM services WHERE id=? AND active=1").get(service_id);
    if (!service) return res.status(400).json({ ok: false, error: "invalid_service" });

    const stmt = db.prepare(`
      INSERT INTO orders (customer_name, phone, service_id, service_name, note)
      VALUES (?,?,?,?,?)
    `);
    const info = stmt.run(
      String(customer_name).trim(),
      String(phone).trim(),
      service.id,
      service.name,
      (note || "").trim()
    );

    const orderId = info.lastInsertRowid;

    const msg =
`طلب جديد من ${SITE_NAME} ✅
رقم الطلب: ${orderId}
الخدمة: ${service.name}
الاسم: ${customer_name}
الهاتف: ${phone}
ملاحظة: ${note || "-"}`;

    // إشعار تيليجرام (اختياري)
    const tg = await sendTelegram(msg);

    // رابط واتساب للمستخدم/لصاحب المنصة
    const wa = waLink(msg);

    res.json({ ok: true, order_id: orderId, whatsapp_url: wa, telegram: tg });
  } catch (e) {
    console.error("ORDER_ERROR:", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

// صفحات الإدارة
app.get("/admin", requireAdmin, (req, res) => res.sendFile(__dirname + "/public/admin.html"));

app.get("/admin/login", (req, res) => res.send(`
<!doctype html><html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول الإدارة</title>
<style>body{font-family:system-ui;background:#0b1220;color:#fff;display:grid;place-items:center;height:100vh;margin:0}
.card{background:#111a2e;padding:18px;border-radius:12px;width:min(360px,92vw)}
input,button{width:100%;padding:12px;border-radius:10px;border:1px solid #2b3a5c;background:#0b1220;color:#fff;margin-top:10px}
button{background:#10b981;border:0;font-weight:700;cursor:pointer}
small{opacity:.8}</style></head>
<body><div class="card">
<h3>تسجيل دخول الإدارة</h3>
<form method="post" action="/admin/login">
<input name="user" placeholder="المستخدم" required>
<input name="pass" placeholder="كلمة المرور" type="password" required>
<button>دخول</button>
</form>
<small>غيّر البيانات من ENV في Render</small>
</div></body></html>
`));

app.post("/admin/login", (req, res) => {
  const { user, pass } = req.body || {};
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    res.cookie("admin", "1", { httpOnly: true, sameSite: "lax" });
    return res.redirect("/admin");
  }
  return res.status(401).send("فشل تسجيل الدخول");
});

app.post("/admin/logout", (req, res) => {
  res.clearCookie("admin");
  res.redirect("/");
});

// API للإدارة
app.get("/api/admin/orders", requireAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 200").all();
  res.json({ ok: true, orders: rows, siteName: SITE_NAME });
});

app.get("/api/admin/status", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    telegram: TG_BOT_TOKEN && TG_CHAT_ID ? "مفعل" : "غير مفعل",
    whatsapp: WHATSAPP_NUMBER ? "مفعل" : "غير مفعل",
    whatsappNumber: WHATSAPP_NUMBER
  });
});

app.listen(PORT, () => {
  console.log("RUNNING:", PORT);
});
