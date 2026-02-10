const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const axios = require("axios");

const db = require("./db");
const { requireAuth } = require("./auth");

const app = express();

/* ================= ENV ================= */

const PORT = process.env.PORT || 3000;
const SITE_NAME = process.env.SITE_NAME || "Achir Platform";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin12345!";

const WA_TOKEN = process.env.WA_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || "";
const WA_ADMIN_NOTIFY = process.env.WA_ADMIN_NOTIFY || "";

/* ================= MIDDLEWARE ================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "ashir_secret",
    resave: false,
    saveUninitialized: false
  })
);

app.use(express.static("public"));

/* ================= CREATE ADMIN ================= */

function createAdmin() {
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(ADMIN_EMAIL);

  if (!user) {
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

    console.log("Admin created");
  }
}

createAdmin();

/* ================= WHATSAPP ================= */

async function sendWhatsApp(message) {
  if (!WA_TOKEN) return;

  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: WA_ADMIN_NOTIFY,
        type: "text",
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (e) {
    console.log("WhatsApp error:", e.message);
  }
}

/* ================= ROUTES ================= */

/* home */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/* health check */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ================= ORDER API ================= */

app.post("/api/order", async (req, res) => {
  const name = req.body.name;
  const phone = req.body.phone;
  const service = req.body.service;

  if (!name || !phone || !service) {
    return res.json({ ok: false });
  }

  const id = nanoid();

  db.prepare(
    "INSERT INTO orders (id,name,phone,service,created_at) VALUES (?,?,?,?,?)"
  ).run(
    id,
    name,
    phone,
    service,
    new Date().toISOString()
  );

  await sendWhatsApp(
    `طلب جديد\nالاسم: ${name}\nالهاتف: ${phone}\nالخدمة: ${service}`
  );

  res.json({ ok: true });
});

/* ================= ADMIN LOGIN ================= */

app.get("/admin/login", (req, res) => {
  res.send(`
  <h2>Admin Login</h2>
  <form method="POST">
  <input name="email" placeholder="email"/><br>
  <input name="password" type="password" placeholder="password"/><br>
  <button>Login</button>
  </form>
  `);
});

app.post("/admin/login", (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const user = db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(email);

  if (user && bcrypt.compareSync(password, user.password_hash)) {
    req.session.user = user;
    res.redirect("/admin");
  } else {
    res.send("Login failed");
  }
});

/* ================= ADMIN PANEL ================= */

app.get("/admin", requireAuth, (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders ORDER BY created_at DESC")
    .all();

  let html = "<h1>لوحة الإدارة</h1>";

  orders.forEach((o) => {
    html += `
    <div style="border:1px solid #ccc;padding:10px;margin:10px">
    <b>الاسم:</b> ${o.name}<br>
    <b>الهاتف:</b> ${o.phone}<br>
    <b>الخدمة:</b> ${o.service}<br>
    <b>الوقت:</b> ${o.created_at}
    </div>
    `;
  });

  res.send(html);
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
