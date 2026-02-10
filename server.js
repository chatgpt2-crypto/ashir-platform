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
const WA_ADMIN_NOTIFY = process.env.WA_ADMIN_NOTIFY || "";

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
function htmlLayout({ title, body, extraHead = "" }) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link rel="stylesheet" href="/admin.css">
${extraHead}
</head>
<body>
<header class="topbar">
  <div class="container topbar-inner">
    <div class="brand">
      <div class="logo">A</div>
      <div>
        <div class="brand-title">${SITE_NAME}</div>
        <div class="brand-sub">لوحة الإدارة</div>
      </div>
    </div>
    <nav class="nav">
      <a class="nav-link" href="/" target="_blank">الموقع</a>
      <a class="nav-link" href="/admin">الطلبات</a>
      <form method="POST" action="/admin/logout" class="inline">
        <button class="btn btn-ghost" type="submit">خروج</button>
      </form>
    </nav>
  </div>
</header>
<main class="container">
${body}
</main>
</body>
</html>`;
}

async function sendWhatsApp(text) {
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

// fixes for trailing slashes
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
  const created_at = new Date().toISOString();

  db.prepare("INSERT INTO orders (id,name,phone,service,created_at) VALUES (?,?,?,?,?)")
    .run(id, name, phone, service, created_at);

  await sendWhatsApp(
    `📩 طلب جديد - ${SITE_NAME}\n\n👤 الاسم: ${name}\n📞 الهاتف: ${phone}\n🧾 الخدمة: ${service}\n🆔 رقم الطلب: ${id}`
  );

  res.json({ ok: true, id });
});

/** Admin login */
app.get("/admin/login", (req, res) => {
  const body = `
  <section class="card auth-card">
    <h1>دخول الإدارة</h1>
    <p class="muted">أدخل البريد وكلمة المرور.</p>
    <form method="POST" action="/admin/login" class="grid">
      <label class="field">
        <span>البريد</span>
        <input name="email" placeholder="admin@example.com" required />
      </label>
      <label class="field">
        <span>كلمة المرور</span>
        <input name="password" type="password" placeholder="••••••••" required />
      </label>
      <button class="btn btn-primary" type="submit">دخول</button>
      <a class="btn btn-ghost" href="/" target="_blank">رجوع للموقع</a>
    </form>
  </section>
  `;
  res.send(
    htmlLayout({
      title: `${SITE_NAME} | Admin Login`,
      body,
      extraHead: `<style>.topbar{display:none}</style>`
    })
  );
});

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

app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

/** ===== Admin APIs (for dashboard) ===== */
app.get("/api/admin/stats", requireAuth, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS c FROM orders").get().c;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const todayCount = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE created_at >= ?").get(start).c;

  const last7Start = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const last7 = db.prepare("SELECT COUNT(*) AS c FROM orders WHERE created_at >= ?").get(last7Start).c;

  res.json({ ok: true, total, today: todayCount, last7 });
});

app.get("/api/admin/orders", requireAuth, (req, res) => {
  const q = String(req.query.q || "").trim();
  const from = String(req.query.from || "").trim(); // ISO
  const to = String(req.query.to || "").trim();     // ISO
  const limit = Math.min(parseInt(req.query.limit || "200", 10), 500);

  let where = "1=1";
  const params = [];

  if (q) {
    where += " AND (name LIKE ? OR phone LIKE ? OR service LIKE ? OR id LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (from) {
    where += " AND created_at >= ?";
    params.push(from);
  }
  if (to) {
    where += " AND created_at <= ?";
    params.push(to);
  }

  const rows = db
    .prepare(`SELECT id,name,phone,service,created_at FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit);

  res.json({ ok: true, rows });
});

app.get("/api/admin/orders/:id", requireAuth, (req, res) => {
  const id = String(req.params.id);
  const row = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!row) return res.status(404).json({ ok: false });
  res.json({ ok: true, row });
});

app.delete("/api/admin/orders/:id", requireAuth, (req, res) => {
  const id = String(req.params.id);
  const info = db.prepare("DELETE FROM orders WHERE id=?").run(id);
  res.json({ ok: true, deleted: info.changes });
});

app.get("/admin/export.csv", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT id,name,phone,service,created_at FROM orders ORDER BY created_at DESC").all();
  const esc = (s) => `"${String(s ?? "").replaceAll('"', '""')}"`;
  const csv = [
    ["id", "name", "phone", "service", "created_at"].join(","),
    ...rows.map(r => [esc(r.id), esc(r.name), esc(r.phone), esc(r.service), esc(r.created_at)].join(","))
  ].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="orders.csv"`);
  res.send("\uFEFF" + csv); // BOM for Excel Arabic
});

/** Admin dashboard UI */
app.get("/admin", requireAuth, (req, res) => {
  const body = `
  <section class="grid-2">
    <div class="card stat">
      <div class="stat-title">كل الطلبات</div>
      <div class="stat-value" id="stat-total">—</div>
      <div class="stat-sub muted">منذ بداية المنصة</div>
    </div>
    <div class="card stat">
      <div class="stat-title">طلبات اليوم</div>
      <div class="stat-value" id="stat-today">—</div>
      <div class="stat-sub muted">حسب توقيت السيرفر</div>
    </div>
    <div class="card stat">
      <div class="stat-title">آخر 7 أيام</div>
      <div class="stat-value" id="stat-7">—</div>
      <div class="stat-sub muted">نشاط الأسبوع</div>
    </div>
    <div class="card stat">
      <div class="stat-title">تصدير</div>
      <div class="stat-value">CSV</div>
      <div class="stat-sub"><a class="link" href="/admin/export.csv">تحميل ملف الطلبات</a></div>
    </div>
  </section>

  <section class="card">
    <div class="toolbar">
      <div class="toolbar-left">
        <h2 style="margin:0">الطلبات</h2>
        <span class="pill" id="count-pill">0</span>
      </div>

      <div class="toolbar-right">
        <input id="q" class="input" placeholder="بحث: اسم / هاتف / خدمة / رقم الطلب" />
        <button class="btn btn-ghost" id="btn-refresh">تحديث</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>الوقت</th>
            <th>الاسم</th>
            <th>الهاتف</th>
            <th>الخدمة</th>
            <th>رقم</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="tbody">
          <tr><td colspan="6" class="muted">جاري التحميل…</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="card" id="detail" style="display:none">
    <div class="detail-head">
      <h3 style="margin:0">تفاصيل الطلب</h3>
      <button class="btn btn-ghost" id="detail-close">إغلاق</button>
    </div>
    <div class="detail-grid">
      <div class="kv"><div class="k">رقم الطلب</div><div class="v" id="d-id">—</div></div>
      <div class="kv"><div class="k">التاريخ</div><div class="v" id="d-time">—</div></div>
      <div class="kv"><div class="k">الاسم</div><div class="v" id="d-name">—</div></div>
      <div class="kv"><div class="k">الهاتف</div><div class="v" id="d-phone">—</div></div>
      <div class="kv" style="grid-column:1/-1"><div class="k">الخدمة</div><div class="v" id="d-service">—</div></div>
    </div>

    <div class="detail-actions">
      <button class="btn btn-danger" id="btn-delete">حذف الطلب</button>
    </div>
  </section>

<script>
async function getJSON(url, opts){
  const r = await fetch(url, opts);
  return await r.json();
}

function fmtTime(iso){
  try { return new Date(iso).toLocaleString(); } catch(e){ return iso; }
}

let currentDetailId = null;

async function loadStats(){
  const s = await getJSON('/api/admin/stats');
  if(!s.ok) return;
  document.getElementById('stat-total').textContent = s.total;
  document.getElementById('stat-today').textContent = s.today;
  document.getElementById('stat-7').textContent = s.last7;
}

async function loadOrders(){
  const q = document.getElementById('q').value.trim();
  const url = new URL(location.origin + '/api/admin/orders');
  if(q) url.searchParams.set('q', q);
  url.searchParams.set('limit', '200');

  const data = await getJSON(url.toString());
  const tb = document.getElementById('tbody');
  if(!data.ok){ tb.innerHTML = '<tr><td colspan="6" class="muted">خطأ في التحميل</td></tr>'; return; }

  document.getElementById('count-pill').textContent = data.rows.length;

  if(!data.rows.length){
    tb.innerHTML = '<tr><td colspan="6" class="muted">لا توجد طلبات</td></tr>';
    return;
  }

  tb.innerHTML = data.rows.map(r => \`
    <tr>
      <td class="muted">\${fmtTime(r.created_at)}</td>
      <td><b>\${escapeHtml(r.name)}</b></td>
      <td>\${escapeHtml(r.phone)}</td>
      <td>\${escapeHtml(r.service)}</td>
      <td class="mono">\${escapeHtml(r.id)}</td>
      <td><button class="btn btn-small" data-open="\${r.id}">فتح</button></td>
    </tr>
  \`).join('');

  tb.querySelectorAll('[data-open]').forEach(btn=>{
    btn.addEventListener('click', ()=> openDetail(btn.getAttribute('data-open')));
  });
}

function escapeHtml(s){
  return String(s||'')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

async function openDetail(id){
  const d = await getJSON('/api/admin/orders/' + encodeURIComponent(id));
  if(!d.ok) return;

  currentDetailId = id;
  document.getElementById('detail').style.display = 'block';
  document.getElementById('d-id').textContent = d.row.id;
  document.getElementById('d-time').textContent = fmtTime(d.row.created_at);
  document.getElementById('d-name').textContent = d.row.name;
  document.getElementById('d-phone').textContent = d.row.phone;
  document.getElementById('d-service').textContent = d.row.service;
  window.scrollTo({ top: document.getElementById('detail').offsetTop - 80, behavior: 'smooth' });
}

async function deleteCurrent(){
  if(!currentDetailId) return;
  if(!confirm('تأكيد حذف الطلب؟')) return;
  const r = await getJSON('/api/admin/orders/' + encodeURIComponent(currentDetailId), { method:'DELETE' });
  if(r.ok){
    document.getElementById('detail').style.display = 'none';
    currentDetailId = null;
    await loadStats();
    await loadOrders();
  }
}

document.getElementById('btn-refresh').addEventListener('click', async ()=> {
  await loadStats(); await loadOrders();
});
document.getElementById('q').addEventListener('input', debounce(loadOrders, 400));
document.getElementById('detail-close').addEventListener('click', ()=> {
  document.getElementById('detail').style.display = 'none';
  currentDetailId = null;
});
document.getElementById('btn-delete').addEventListener('click', deleteCurrent);

function debounce(fn, ms){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); }
}

loadStats();
loadOrders();
</script>
  `;
  res.send(htmlLayout({ title: `${SITE_NAME} | Admin`, body }));
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ ${SITE_NAME} running on port ${PORT}`);
});
