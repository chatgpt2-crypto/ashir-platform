const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");

const db = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin12345!";

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

/* create admin */
const user = db
  .prepare("SELECT * FROM users WHERE email=?")
  .get(ADMIN_EMAIL);

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

}

/* health */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* home */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

/* create order */
app.post("/api/order", (req, res) => {

  const id = nanoid();

  db.prepare(
    "INSERT INTO orders (id,name,phone,service,created_at) VALUES (?,?,?,?,?)"
  ).run(
    id,
    req.body.name,
    req.body.phone,
    req.body.service,
    new Date().toISOString()
  );

  res.json({ ok: true });

});

/* login page */
app.get("/admin/login", (req, res) => {

  res.send(`
  <h2>Admin Login</h2>
  <form method="POST">
  <input name="email"/><br>
  <input name="password" type="password"/><br>
  <button>Login</button>
  </form>
  `);

});

/* login */
app.post("/admin/login", (req, res) => {

  const user = db
    .prepare("SELECT * FROM users WHERE email=?")
    .get(req.body.email);

  if (!user) return res.send("فشل تسجيل الدخول");

  const ok = bcrypt.compareSync(
    req.body.password,
    user.password_hash
  );

  if (!ok) return res.send("فشل تسجيل الدخول");

  req.session.user = user;

  res.redirect("/admin");

});

/* admin panel */
app.get("/admin", (req, res) => {

  if (!req.session.user)
    return res.redirect("/admin/login");

  const orders = db
    .prepare("SELECT * FROM orders")
    .all();

  let html = "<h1>لوحة الإدارة</h1>";

  orders.forEach(o => {

    html += `
    <div>
    ${o.name} - ${o.phone} - ${o.service}
    </div>
    `;

  });

  res.send(html);

});

/* start */
app.listen(PORT, () => {

  console.log("Server started");

});
