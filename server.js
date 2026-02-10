const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const axios = require("axios");

const db = require("./db");
const { requireAuth } = require("./auth");

const app = express();

/** ===== ENV ===== */
const PORT = process.env.PORT || 3000;
const SITE_NAME = process.env.SITE_NAME || "Achir Platform";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin12345!";

// WhatsApp Cloud API (اختياري)
const WA_TOKEN = process.env.WA_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "";
const WA_ADMIN_NOTIFY = process.env.WA_ADMIN_NOTIFY || ""; // مثال: 213666376417

/** ===== MIDDLEWARE ===== */
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

app.use(express.static("public"));

/** ===== HELPERS ===== */
function htmlPage(title, body) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  body{font-family:Arial;margin:0;background:#0b1220;color:#fff}
  .wrap{max-width:900px;margin:auto;padding:18px}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px;margin:12px 0}
  input,button,select{font:inherit;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:#fff}
  button{cursor:pointer}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.12);text-align:right}
  a{color:#9ae6b4}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:720px){.row{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">${body}</div>
</body>
</html>`;
}

async function sendWhatsApp(text) {
  // إذا ماعندكش مفاتيح واتساب، نتجاوز
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID || !WA_ADMIN_NOTIFY) return;

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: WA_ADMIN_NOTIFY,
        type: "text",
        text: { body: text }
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.log("WA send error:", e?.response?.data || e.message);
  }
}

/** ===== CREATE ADMIN (ONCE) ===== */
function ensureAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get(ADMIN_EMAIL);
  if (!exists) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare("INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)")
      .run(nanoid(), ADMIN_EMAIL, hash, "admin", new Date().toISOString());
    console.log("Admin created:", ADMIN_EMAIL);
  }
}
ensureAdmin();

/** ===== ROUTES ===== */

// Redirects to avoid / ending issues
app.get("/admin/", (req, res) => res.redirect("/admin"));
app.get("/admin/login/", (req, res) => res.redirect("/admin/login"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/** API create order */
app.post("/api/order", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const service = String(req.body?.service || "").trim();

  if (!name || !phone || !service) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const id = nanoid();
  db.prepare("INSERT INTO orders (id,name,phone,service,created_at) VALUES (?,?,?,?,?)")
    .run(id, name, phone, service, new Date().toISOString());

  // WhatsApp notify (اختياري)
  await sendWhatsApp(`📩 طلب جديد - ${SITE_NAME}\n\n👤 الاسم: ${name}\n📞 الهاتف: ${phone}\n🧾 الخدمة: ${service}\n🆔 رقم الطلب: ${id}`);

  res.json({ ok: true, id });
});

/** Admin login page */
app.get("/admin/login", (req, res) => {
  const body = `
  <div class="card">
    <h2 style="margin:0 0 10px">${SITE_NAME} — دخول الإدارة</h2>
    <form method="POST" action="/admin/login">
      <div class="row">
        <input name="email" placeholder="Email" required />
        <input name="password" placeholder="Password" type="password" required />
      </div>
      <div style="margin-top:10px">
        <button type="submit">دخول</button>
        <a style="margin-right:10px" href="/">الموقع</a>
      </div>
    </form>
  </div>`;
  res.send(htmlPage(`${SITE_NAME} | Admin Login`, body));
});

/** Admin login action */
app.post("/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  const user = db.prepare("SELECT id,email,password_hash,role FROM users WHERE email=?").get(email);
  if (!user || user.role !== "admin") return res.status(401).send("Login failed");

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).send("Login failed");

  req.session.user = { id: user.id, email: user.email, role: user.role };
  res.redirect("/admin");
});

/** Admin logout */
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

/** Admin dashboard */
app.get("/admin", requireAuth, (req, res) => {
  const orders = db.prepare("SELECT id,name,phone,service,created_at FROM orders ORDER BY created_at DESC LIMIT 300").all();

  const rows = orders.map(o => `
    <tr>
      <td><b>${o.id}</b><div style="opacity:.7;font-size:12px">${new Date(o.created_at).toLocaleString()}</div></td>
      <td>${o.name}</td>
      <td>${o.phone}</td>
      <td>${o.service}</td>
    </tr>
  `).join("");

  const body = `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <h2 style="margin:0">${SITE_NAME} — لوحة الإدارة</h2>
      <form method="POST" action="/admin/logout" style="margin:0">
        <button type="submit">خروج</button>
      </form>
    </div>
    <p style="opacity:.8;margin:8px 0 0">عدد الطلبات: <b>${orders.length}</b></p>
  </div>

  <div class="card" style="overflow:auto">
    <table>
      <thead>
        <tr>
          <th>رقم/تاريخ</th>
          <th>الاسم</th>
          <th>الهاتف</th>
          <th>الخدمة</th>
        </tr>
      </thead>
      <tbody>
        ${orders.length ? rows : `<tr><td colspan="4" style="opacity:.7">لا توجد طلبات بعد.</td></tr>`}
      </tbody>
    </table>
  </div>
  `;
  res.send(htmlPage(`${SITE_NAME} | Admin`, body));
});

/** Health */
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ ${SITE_NAME} running on port ${PORT}`);
});
