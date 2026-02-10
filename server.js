require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const { db, init } = require("./db");
const { requireAuth, requireApiAuth, requireCustomer } = require("./auth");

init();

const app = express();

const PORT = process.env.PORT || 3000;
const SITE_NAME = process.env.SITE_NAME || "أشير";
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "213666376417";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev_secret_change_me";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("tiny"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: __dirname }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use("/login", authLimiter);
app.use("/api", rateLimit({ windowMs: 60 * 1000, max: 60 }));

const csrfProtection = csrf();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/public", express.static(path.join(__dirname, "public"), {
  setHeaders(res){ res.setHeader("Cache-Control", "public, max-age=3600"); }
}));

function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin12345!";
  const row = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
  if(!row){
    const id = nanoid();
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO users (id,email,password_hash,role,created_at) VALUES (?,?,?,?,?)")
      .run(id, adminEmail, hash, "admin", new Date().toISOString());
    console.log("✅ Admin created:", adminEmail, "password:", adminPassword);
  }
}
ensureAdmin();

function ensureServices(){
  const cnt = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
  if(cnt === 0){
    const now = new Date().toISOString();
    const services = [
      { name: "باقة البداية", description: "واجهة إطلاق مرتبة + أقسام أساسية + طلب واتساب.", price: 9900 },
      { name: "باقة احتراف", description: "تحسين تصميم ومحتوى + أداء أفضل + أقسام إضافية.", price: 19900 },
      { name: "باقة شركة", description: "جاهزة للتوسع لاحقاً: لوحة إدارة + نظام طلبات.", price: 39900 },
    ];
    const stmt = db.prepare("INSERT INTO services (id,name,description,price_dzd,is_active,created_at) VALUES (?,?,?,?,?,?)");
    for(const s of services){
      stmt.run(nanoid(), s.name, s.description, s.price, 1, now);
    }
    console.log("✅ Services seeded");
  }
}
ensureServices();

function waLink(message){
  const text = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/health", (req, res)=> res.json({ ok:true }));

app.get("/login", csrfProtection, (req, res) => {
  res.render("login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: null });
});

app.post("/login", csrfProtection, (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT id,email,password_hash,role FROM users WHERE email=?").get(email || "");
  if(!user) return res.status(401).render("login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "بيانات الدخول غير صحيحة" });

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if(!ok) return res.status(401).render("login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "بيانات الدخول غير صحيحة" });

  req.session.user = { id: user.id, email: user.email, role: user.role };
  res.redirect("/admin");
});

app.post("/logout", (req, res)=> req.session.destroy(()=> res.redirect("/")));


// ---- Customer auth & account
app.get("/signup", csrfProtection, (req, res)=>{
  res.render("signup", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: null });
app.get("/admin/services", requireAuth, (req, res)=>{
  res.render("admin_services", { siteName: SITE_NAME, user: req.session.user });
});

// Admin services API CRUD
app.get("/api/admin/services", requireApiAuth, (req, res)=>{
  const services = db.prepare("SELECT id,name,description,price_dzd,is_active,created_at FROM services ORDER BY created_at DESC").all();
  res.json({ ok:true, services });
});

app.post("/api/admin/services", requireApiAuth, (req, res)=>{
  const { name, description, price_dzd } = req.body || {};
  if(!name || !description) return res.status(400).json({ ok:false, error:"missing_fields" });
  const id = nanoid();
  db.prepare("INSERT INTO services (id,name,description,price_dzd,is_active,created_at) VALUES (?,?,?,?,?,?)")
    .run(id, String(name).trim(), String(description).trim(), Number(price_dzd||0), 1, new Date().toISOString());
  res.json({ ok:true, id });
});

app.put("/api/admin/services/:id", requireApiAuth, (req, res)=>{
  const id = req.params.id;
  const { name, description, price_dzd } = req.body || {};
  const r = db.prepare("UPDATE services SET name=?, description=?, price_dzd=? WHERE id=?")
    .run(String(name||"").trim(), String(description||"").trim(), Number(price_dzd||0), id);
  if(r.changes===0) return res.status(404).json({ ok:false, error:"not_found" });
  res.json({ ok:true });
});

app.post("/api/admin/services/:id/toggle", requireApiAuth, (req, res)=>{
  const id = req.params.id;
  const s = db.prepare("SELECT is_active FROM services WHERE id=?").get(id);
  if(!s) return res.status(404).json({ ok:false, error:"not_found" });
  const next = s.is_active ? 0 : 1;
  db.prepare("UPDATE services SET is_active=? WHERE id=?").run(next, id);
  res.json({ ok:true, is_active: next });
});

});

app.post("/signup", csrfProtection, (req, res)=>{
  const { full_name, wilaya, phone, email, password } = req.body || {};
  if(!full_name || !wilaya || !email || !password){
    return res.status(400).render("signup", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "اكمل كل الحقول المطلوبة" });
  }
  const exists = db.prepare("SELECT id FROM users WHERE email=?").get((email||"").trim());
  if(exists){
    return res.status(409).render("signup", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "هذا البريد مستعمل" });
  }
  const id = nanoid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare("INSERT INTO users (id,email,password_hash,role,full_name,phone,wilaya,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, email.trim(), hash, "customer", full_name.trim(), (phone||"").trim(), wilaya.trim(), new Date().toISOString());

  req.session.customer = { id, email: email.trim(), role:"customer", full_name: full_name.trim() };
  res.redirect("/account");
});

app.get("/customer/login", csrfProtection, (req, res)=>{
  res.render("customer_login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: null });
});

app.post("/customer/login", csrfProtection, (req, res)=>{
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT id,email,password_hash,role,full_name FROM users WHERE email=?").get((email||"").trim());
  if(!user || user.role !== "customer") return res.status(401).render("customer_login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "بيانات الدخول غير صحيحة" });

  const ok = bcrypt.compareSync(password || "", user.password_hash);
  if(!ok) return res.status(401).render("customer_login", { siteName: SITE_NAME, csrfToken: req.csrfToken(), error: "بيانات الدخول غير صحيحة" });

  req.session.customer = { id: user.id, email: user.email, role:"customer", full_name: user.full_name };
  res.redirect("/account");
});

app.post("/customer/logout", (req, res)=>{
  delete req.session.customer;
  res.redirect("/");
});

app.get("/account", requireCustomer, csrfProtection, (req, res)=>{
  const services = db.prepare("SELECT id,name,price_dzd FROM services WHERE is_active=1 ORDER BY price_dzd ASC").all();
  const orders = db.prepare(`
    SELECT id, service_name_snapshot, status, amount_dzd, payment_method, is_paid, created_at
    FROM orders
    WHERE user_id=?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(req.session.customer.id);

  res.render("account", {
    siteName: SITE_NAME,
    user: req.session.customer,
    services,
    orders,
    csrfToken: req.csrfToken(),
    flash: req.session.flash || null
  });
  req.session.flash = null;
});

app.post("/account/order", requireCustomer, csrfProtection, (req, res)=>{
  const { service_id, payment_method, payment_ref, message } = req.body || {};
  if(!service_id || !payment_method){
    req.session.flash = "⚠️ اختر الباقة وطريقة الدفع.";
    return res.redirect("/account");
  }
  const service = db.prepare("SELECT id,name,price_dzd FROM services WHERE id=? AND is_active=1").get(service_id);
  if(!service){
    req.session.flash = "⚠️ باقة غير صالحة.";
    return res.redirect("/account");
  }

  const id = nanoid();
  const customer = db.prepare("SELECT full_name,wilaya,phone,email FROM users WHERE id=?").get(req.session.customer.id);

  db.prepare(`INSERT INTO orders
    (id, user_id, customer_name, wilaya, phone, service_id, service_name_snapshot, message, status, amount_dzd, payment_method, payment_ref, is_paid, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run(
    id,
    req.session.customer.id,
    customer.full_name || customer.email,
    customer.wilaya || "-",
    customer.phone || "",
    service.id,
    service.name,
    (message||"").trim(),
    "new",
    service.price_dzd,
    payment_method,
    (payment_ref||"").trim(),
    0,
    new Date().toISOString()
  );

  req.session.flash = `✅ تم إنشاء الطلب رقم ${id}.`;
  res.redirect("/account");
});


app.get("/admin", requireAuth, (req, res) => {
  res.render("admin", { siteName: SITE_NAME, user: req.session.user });
});

// Public API
app.get("/api/services", (req, res)=>{
  const rows = db.prepare("SELECT id,name,description,price_dzd FROM services WHERE is_active=1 ORDER BY price_dzd ASC").all();
  res.json({ ok:true, services: rows });
});

app.post("/api/orders", (req, res)=>{
  const { customer_name, wilaya, phone, service_id, message, payment_method, payment_ref } = req.body || {};
  if(!customer_name || !wilaya || !service_id){
    return res.status(400).json({ ok:false, error:"missing_fields" });
  }
  const service = db.prepare("SELECT id,name FROM services WHERE id=? AND is_active=1").get(service_id);
  if(!service){
    return res.status(400).json({ ok:false, error:"invalid_service" });
  }

  const id = nanoid();
  db.prepare(`INSERT INTO orders
      (id, customer_name, wilaya, phone, service_id, service_name_snapshot, message, status, amount_dzd, payment_method, payment_ref, is_paid, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      id,
      customer_name.trim(),
      wilaya.trim(),
      (phone || "").trim(),
      service.id,
      service.name,
      (message || "").trim(),
      "new",
      service.price_dzd,
      (payment_method || null),
      (payment_ref || "").trim(),
      0,
      new Date().toISOString()
    );

  const waMsg =
`السلام عليكم،
طلب جديد من منصة ${SITE_NAME} ✅
الباقة: ${service.name}
الاسم: ${customer_name}
الولاية: ${wilaya}
الهاتف: ${phone || "-"}
التفاصيل: ${message || "-"}

رقم الطلب: ${id}`;
  res.json({ ok:true, order_id: id, whatsapp_url: waLink(waMsg) });
});

// Admin API
app.get("/api/admin/overview", requireApiAuth, (req, res)=>{
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) AS contacted_count,
      SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) AS done_count,
      SUM(CASE WHEN status='canceled' THEN 1 ELSE 0 END) AS canceled_count,
      COUNT(*) AS total_count
    FROM orders
  `).get();

  const latest = db.prepare(`
    SELECT id, customer_name, wilaya, phone, service_name_snapshot, status, amount_dzd, payment_method, payment_ref, is_paid, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  res.json({ ok:true, counts, latest, whatsappNumber: WHATSAPP_NUMBER, siteName: SITE_NAME });
});

app.get("/api/admin/orders", requireApiAuth, (req, res)=>{
  const status = (req.query.status || "").trim();
  let rows;
  if(status){
    rows = db.prepare(`
      SELECT id, customer_name, wilaya, phone, service_name_snapshot, message, status, amount_dzd, payment_method, payment_ref, is_paid, created_at
      FROM orders
      WHERE status=?
      ORDER BY created_at DESC
      LIMIT 200
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT id, customer_name, wilaya, phone, service_name_snapshot, message, status, amount_dzd, payment_method, payment_ref, is_paid, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 200
    `).all();
  }
  res.json({ ok:true, orders: rows });
});

app.post("/api/admin/orders/:id/status", requireApiAuth, (req, res)=>{
  const id = req.params.id;
  const { status } = req.body || {};
  const allowed = new Set(["new","contacted","done","canceled"]);
  if(!allowed.has(status)) return res.status(400).json({ ok:false, error:"invalid_status" });
app.post("/api/admin/orders/:id/pay", requireApiAuth, (req, res)=>{
  const id = req.params.id;
  const { is_paid } = req.body || {};
  const v = is_paid ? 1 : 0;
  const r = db.prepare("UPDATE orders SET is_paid=?, paid_at=? WHERE id=?")
    .run(v, v ? new Date().toISOString() : null, id);
  if(r.changes===0) return res.status(404).json({ ok:false, error:"not_found" });
  res.json({ ok:true });
});


  const r = db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, id);
  if(r.changes === 0) return res.status(404).json({ ok:false, error:"not_found" });
  res.json({ ok:true });
});

app.get("/api/admin/whatsapp/:id", requireApiAuth, (req, res)=>{
  const id = req.params.id;
  const o = db.prepare(`
    SELECT id, customer_name, wilaya, phone, service_name_snapshot, message, status, amount_dzd, payment_method, payment_ref, is_paid, created_at
    FROM orders WHERE id=?
  `).get(id);
  if(!o) return res.status(404).json({ ok:false, error:"not_found" });

  const waMsg =
`السلام عليكم،
تم استلام طلبك ✅
الباقة: ${o.service_name_snapshot}
الاسم: ${o.customer_name}
الولاية: ${o.wilaya}
الهاتف: ${o.phone || "-"}
التفاصيل: ${o.message || "-"}

رقم الطلب: ${o.id}`;
  res.json({ ok:true, whatsapp_url: waLink(waMsg) });
});

app.listen(PORT, ()=> console.log(`✅ ${SITE_NAME} running on http://localhost:${PORT}`));
