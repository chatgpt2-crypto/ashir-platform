const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");

const db = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

// بيانات الأدمن (ثابتة)
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin12345!";

/* Middlewares */
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

// ملفات الواجهة
app.use(express.static("public"));

/* ✅ RESET ADMIN كل تشغيل (يحل فشل تسجيل الدخول) */
try {
  db.prepare("DELETE FROM users WHERE email=?").run(ADMIN_EMAIL);

  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

  db.prepare(
    "INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)"
  ).run(
    nanoid(),
    ADMIN_EMAIL,
    hash,
    "admin",
    new Date().toISOString()
  );

  console.log("✅ Admin reset OK:", ADMIN_EMAIL);
} catch (e) {
  console.log("Admin reset error:", e.message);
}

/* Health */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* Home */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/* API: Create order */
app.post("/api/order", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const service = String(req.body?.service || "").trim();

  if (!name || !phone || !service) return res.status(400).json({ ok: false });

  const id = nanoid();

  db.prepare(
    "INSERT INTO orders (id,name,phone,service,created_at) VALUES (?,?,?,?,?)"
  ).run(id, name, phone, service, new Date().toISOString());

  res.json({ ok: true, id });
});

/* Admin Login page */
app.get("/admin/login", (req, res) => {
  res.send(`
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Admin Login</title>
<style>
body{font-family:Arial;background:#0f172a;color:#fff;margin:0;padding:30px}
.card{max-width:420px;margin:auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:16px;border-radius:14px}
input,button{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:#fff;margin:8px 0}
button{cursor:pointer}
small{opacity:.8}
</style>
</head>
<body>
  <div class="card">
    <h2>دخول الإدارة</h2>
    <small>الإيميل: ${ADMIN_EMAIL} | الباس: ${ADMIN_PASSWORD}</small>
    <form method="POST" action="/admin/login">
      <input name="email" placeholder="البريد" required />
      <input name="password" type="password" placeholder="كلمة المرور" required />
      <button type="submit">دخول</button>
    </form>
  </div>
</body>
</html>
`);
});

/* Admin Login submit */
app.post("/admin/login", (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.send("فشل تسجيل الدخول");

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.send("فشل تسجيل الدخول");

  req.session.user = { id: user.id, email: user.email, role: user.role };
  return res.redirect("/admin");
});

/* Admin Panel */
app.get("/admin", (req, res) => {
  if (!req.session.user) return res.redirect("/admin/login");

  const orders = db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200")
    .all();

  let rows = orders
    .map(
      (o) => `
<tr>
  <td>${o.name}</td>
  <td>${o.phone}</td>
  <td>${o.service}</td>
  <td style="font-size:12px;opacity:.8">${o.created_at}</td>
</tr>`
    )
    .join("");

  if (!rows) rows = `<tr><td colspan="4">لا توجد طلبات</td></tr>`;

  res.send(`
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>لوحة الإدارة</title>
<style>
body{font-family:Arial;background:#0f172a;color:#fff;margin:0;padding:20px}
.card{max-width:900px;margin:auto;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:16px;border-radius:14px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{padding:10px;border-bottom:1px solid rgba(255,255,255,.12);text-align:right}
a{color:#9ae6b4}
</style>
</head>
<body>
  <div class="card">
    <h2>لوحة الإدارة</h2>
    <a href="/">الرجوع للموقع</a>
    <table>
      <thead>
        <tr>
          <th>الاسم</th>
          <th>الهاتف</th>
          <th>الخدمة</th>
          <th>الوقت</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>
`);
});

/* Start */
app.listen(PORT, () => {
  console.log("✅ Server running on port", PORT);
});
