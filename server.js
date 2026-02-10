const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Admin
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin12345!";

/* ================= Middleware ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "ashir_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

app.use(express.static("public"));

/* ================= DB: Ensure columns ================= */
function ensureOrdersSchema() {
  try {
    const cols = db.prepare("PRAGMA table_info(orders)").all();
    const names = cols.map((c) => c.name);

    if (!names.includes("status")) {
      db.prepare("ALTER TABLE orders ADD COLUMN status TEXT").run();
      // تعبئة افتراضية
      db.prepare("UPDATE orders SET status='new' WHERE status IS NULL OR status=''").run();
      console.log("✅ Added orders.status");
    }

    if (!names.includes("done_at")) {
      db.prepare("ALTER TABLE orders ADD COLUMN done_at TEXT").run();
      console.log("✅ Added orders.done_at");
    }
  } catch (e) {
    console.log("Schema ensure error:", e.message);
  }
}
ensureOrdersSchema();

/* ================= Create/Reset Admin ================= */
try {
  db.prepare("DELETE FROM users WHERE email=?").run(ADMIN_EMAIL);
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.prepare(
    "INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)"
  ).run(nanoid(), ADMIN_EMAIL, hash, "admin", new Date().toISOString());
  console.log("✅ Admin reset OK:", ADMIN_EMAIL);
} catch (e) {
  console.log("Admin reset error:", e.message);
}

/* ================= Helpers ================= */
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/admin/login");
  if (req.session.user.role !== "admin") return res.status(403).send("Forbidden");
  next();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function page(title, body) {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
:root{
  --bg:#0b1220;--card:rgba(255,255,255,.06);--border:rgba(255,255,255,.12);
  --text:#e5e7eb;--muted:rgba(229,231,235,.75);
  --brand:#22c55e;--brand2:#60a5fa;--danger:#ef4444;--warn:#f59e0b;
  --shadow:0 14px 40px rgba(0,0,0,.35);--r:18px;
}
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Arial;color:var(--text);
  background:
    radial-gradient(900px 500px at 80% 10%, rgba(34,197,94,.20), transparent 60%),
    radial-gradient(900px 500px at 10% 30%, rgba(96,165,250,.18), transparent 60%),
    var(--bg);
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1100px;margin:auto;padding:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:var(--shadow)}
.top{position:sticky;top:0;z-index:10;background:linear-gradient(to bottom, rgba(11,18,32,.92), rgba(11,18,32,.55));
  backdrop-filter: blur(10px);border-bottom:1px solid rgba(255,255,255,.06)}
.topInner{max-width:1100px;margin:auto;padding:14px 18px;display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}
.logo{width:40px;height:40px;border-radius:14px;background:linear-gradient(135deg, rgba(34,197,94,.9), rgba(96,165,250,.85))}
.brand h1{margin:0;font-size:18px}
.muted{color:var(--muted);font-size:13px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.btn{
  padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);
  background:rgba(255,255,255,.06);color:var(--text);cursor:pointer;font-weight:700;
}
.btn:hover{filter:brightness(1.06)}
.btnPrimary{background:linear-gradient(135deg, rgba(34,197,94,.9), rgba(34,197,94,.65));border-color:rgba(34,197,94,.35)}
.btnDanger{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.28)}
.btnWarn{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.28)}
.input{
  width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);
  background:rgba(0,0,0,.22);color:var(--text);outline:none;
}
.kpi{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px}
.kpiBox{flex:1;min-width:180px;padding:12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10)}
.kpiBox b{display:block;font-size:20px}
.kpiBox span{display:block;margin-top:6px;color:var(--muted);font-size:13px}
.tableWrap{overflow:auto}
table{width:100%;border-collapse:collapse;min-width:860px}
th,td{padding:12px;border-bottom:1px solid rgba(255,255,255,.10);text-align:right;white-space:nowrap}
th{color:rgba(229,231,235,.85);font-size:13px}
.badge{
  display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);
}
.badgeNew{border-color:rgba(96,165,250,.25);background:rgba(96,165,250,.12);color:#dbeafe}
.badgeDone{border-color:rgba(34,197,94,.25);background:rgba(34,197,94,.12);color:#bbf7d0}
small{color:var(--muted)}
.tabs{display:flex;gap:8px;flex-wrap:wrap}
.tab{padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:13px;color:var(--muted)}
.tab.active{border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.12);color:#bbf7d0}
.actions{display:flex;gap:8px;justify-content:flex-start}
@media(max-width:900px){table{min-width:760px}}
</style>
</head>
<body>
<div class="top">
  <div class="topInner">
    <div class="brand">
      <div class="logo"></div>
      <div>
        <h1>منصة أشير — لوحة الإدارة</h1>
        <div class="muted">إدارة الطلبات • تنفيذ • حذف • تصدير</div>
      </div>
    </div>
    <div class="row">
      <a class="btn" href="/">الرجوع للموقع</a>
      <a class="btn btnPrimary" href="/admin/export.csv">تصدير Excel</a>
      <form method="POST" action="/admin/logout" style="margin:0">
        <button class="btn btnDanger" type="submit">خروج</button>
      </form>
    </div>
  </div>
</div>

<div class="wrap">
${body}
</div>

</body>
</html>`;
}

/* ================= Routes ================= */

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// home
app.get("/", (req, res) => res.sendFile(__dirname + "/public/index.html"));

// create order
app.post("/api/order", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const service = String(req.body?.service || "").trim();

  if (!name || !phone || !service) return res.status(400).json({ ok: false });

  const id = nanoid();
  db.prepare(
    "INSERT INTO orders (id,name,phone,service,created_at,status,done_at) VALUES (?,?,?,?,?,?,?)"
  ).run(id, name, phone, service, new Date().toISOString(), "new", null);

  res.json({ ok: true, id });
});

// admin login page
app.get("/admin/login", (req, res) => {
  res.send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>دخول الإدارة</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Arial;margin:0;padding:30px;background:#0b1220;color:#fff}
.card{max-width:420px;margin:auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:16px;border-radius:16px}
input,button{width:100%;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.25);color:#fff;margin:8px 0}
button{cursor:pointer;font-weight:700;background:linear-gradient(135deg, rgba(34,197,94,.9), rgba(34,197,94,.65));border-color:rgba(34,197,94,.35)}
small{opacity:.8}
a{color:#9ae6b4;text-decoration:none}
</style>
</head>
<body>
  <div class="card">
    <h2 style="margin:0 0 10px">دخول الإدارة</h2>
    <small>email: ${ADMIN_EMAIL} — password: ${ADMIN_PASSWORD}</small>
    <form method="POST" action="/admin/login">
      <input name="email" placeholder="البريد" required />
      <input name="password" type="password" placeholder="كلمة المرور" required />
      <button type="submit">دخول</button>
    </form>
    <div style="margin-top:10px"><a href="/">الرجوع للموقع</a></div>
  </div>
</body>
</html>`);
});

// admin login submit
app.post("/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.send("فشل تسجيل الدخول");

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.send("فشل تسجيل الدخول");

  req.session.user = { id: user.id, email: user.email, role: user.role };
  res.redirect("/admin");
});

// admin logout
app.post("/admin/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/admin/login"));
});

// ✅ toggle done/new
app.post("/admin/orders/:id/toggle", requireAdmin, (req, res) => {
  const id = req.params.id;
  const row = db.prepare("SELECT id,status FROM orders WHERE id=?").get(id);
  if (!row) return res.status(404).send("Not found");

  const next = row.status === "done" ? "new" : "done";
  const doneAt = next === "done" ? new Date().toISOString() : null;

  db.prepare("UPDATE orders SET status=?, done_at=? WHERE id=?").run(next, doneAt, id);
  res.redirect("/admin");
});

// ✅ delete order
app.post("/admin/orders/:id/delete", requireAdmin, (req, res) => {
  const id = req.params.id;
  db.prepare("DELETE FROM orders WHERE id=?").run(id);
  res.redirect("/admin");
});

// ✅ export CSV (يفتح في Excel)
app.get("/admin/export.csv", requireAdmin, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();

  const header = ["id","name","phone","service","status","created_at","done_at"];
  const lines = [header.join(",")];

  for (const o of orders) {
    const row = [
      o.id,
      o.name,
      o.phone,
      o.service,
      o.status || "new",
      o.created_at || "",
      o.done_at || ""
    ].map(csvEscape);
    lines.push(row.join(","));
  }

  const csv = "\ufeff" + lines.join("\n"); // BOM ليفتح عربي صح في Excel
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.send(csv);
});

function csvEscape(v){
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replaceAll('"','""')}"`;
  }
  return s;
}

// admin panel (بحث + فلترة + تنفيذ/حذف)
app.get("/admin", requireAdmin, (req, res) => {
  const filter = String(req.query?.filter || "all"); // all | new | done
  let orders;

  if (filter === "new") {
    orders = db.prepare("SELECT * FROM orders WHERE status!='done' OR status IS NULL ORDER BY created_at DESC LIMIT 500").all();
  } else if (filter === "done") {
    orders = db.prepare("SELECT * FROM orders WHERE status='done' ORDER BY created_at DESC LIMIT 500").all();
  } else {
    orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();
  }

  // KPIs
  const totalAll = db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
  const totalNew = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status!='done' OR status IS NULL").get().c;
  const totalDone = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status='done'").get().c;

  const rows = orders.map(o => {
    const st = (o.status || "new");
    const badge = st === "done"
      ? `<span class="badge badgeDone">✅ تم</span>`
      : `<span class="badge badgeNew">🟦 جديد</span>`;

    const toggleText = st === "done" ? "ارجاع لجديد" : "تم التنفيذ";

    return `
<tr class="rowItem" data-status="${st}">
  <td><b>${escapeHtml(o.name)}</b></td>
  <td>${escapeHtml(o.phone)}</td>
  <td>${escapeHtml(o.service)}</td>
  <td>${badge}</td>
  <td><small>${escapeHtml(o.created_at)}</small></td>
  <td class="actions">
    <form method="POST" action="/admin/orders/${encodeURIComponent(o.id)}/toggle" style="margin:0">
      <button class="btn btnPrimary" type="submit">${toggleText}</button>
    </form>
    <form method="POST" action="/admin/orders/${encodeURIComponent(o.id)}/delete" style="margin:0" onsubmit="return confirm('حذف الطلب نهائياً؟')">
      <button class="btn btnDanger" type="submit">حذف</button>
    </form>
  </td>
</tr>`;
  }).join("");

  const tab = (key, text) => {
    const active = filter === key ? "active" : "";
    const href = key === "all" ? "/admin" : `/admin?filter=${key}`;
    return `<a class="tab ${active}" href="${href}">${text}</a>`;
  };

  const body = `
<div class="card" style="padding:16px">
  <div class="row" style="justify-content:space-between">
    <div>
      <div style="font-size:16px;font-weight:900">الطلبات</div>
      <div class="muted">بحث + فلترة + تنفيذ + حذف + تصدير</div>
    </div>
    <div style="min-width:260px;flex:1;max-width:420px">
      <input id="q" class="input" placeholder="ابحث بالاسم/الهاتف/الخدمة..." />
    </div>
  </div>

  <div class="kpi">
    <div class="kpiBox"><b>${totalAll}</b><span>كل الطلبات</span></div>
    <div class="kpiBox"><b>${totalNew}</b><span>طلبات جديدة</span></div>
    <div class="kpiBox"><b>${totalDone}</b><span>طلبات تم تنفيذها</span></div>
  </div>

  <div style="margin-top:12px" class="tabs">
    ${tab("all", "الكل")}
    ${tab("new", "جديد")}
    ${tab("done", "تم")}
  </div>
</div>

<div class="card tableWrap" style="margin-top:14px">
  <table>
    <thead>
      <tr>
        <th>الاسم</th>
        <th>الهاتف</th>
        <th>الخدمة</th>
        <th>الحالة</th>
        <th>وقت الإنشاء</th>
        <th>إجراءات</th>
      </tr>
    </thead>
    <tbody id="tbody">
      ${rows || `<tr><td colspan="6" style="padding:16px;color:rgba(229,231,235,.75)">لا توجد طلبات</td></tr>`}
    </tbody>
  </table>
</div>

<script>
  const q = document.getElementById("q");
  const tbody = document.getElementById("tbody");
  q.addEventListener("input", () => {
    const v = (q.value || "").toLowerCase().trim();
    const rows = Array.from(tbody.querySelectorAll(".rowItem"));
    rows.forEach(r => {
      const t = r.innerText.toLowerCase();
      r.style.display = t.includes(v) ? "" : "none";
    });
  });
</script>
`;

  res.send(page("لوحة الإدارة — منصة أشير", body));
});

/* start */
app.listen(PORT, () => console.log("✅ Server running on port", PORT));
