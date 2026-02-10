const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { nanoid } = require("nanoid");
const axios = require("axios");
const db = require("./db");
const {requireAuth} = require("./auth");

const app = express();

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
secret:"ashir_secret",
resave:false,
saveUninitialized:false
}));

app.use(express.static("public"));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin12345!";
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_ADMIN_NOTIFY = process.env.WA_ADMIN_NOTIFY;

function sendWhatsApp(text){
if(!WA_TOKEN) return;

axios.post(
`https://graph.facebook.com/v18.0/${WA_PHONE_NUMBER_ID}/messages`,
{
messaging_product:"whatsapp",
to:WA_ADMIN_NOTIFY,
type:"text",
text:{body:text}
},
{
headers:{
Authorization:`Bearer ${WA_TOKEN}`,
"Content-Type":"application/json"
}
});
}

function createAdmin(){
const user = db.prepare("SELECT * FROM users WHERE email=?").get(ADMIN_EMAIL);
if(!user){
const hash = bcrypt.hashSync(ADMIN_PASSWORD,10);
db.prepare("INSERT INTO users VALUES(?,?,?,?)")
.run(nanoid(),ADMIN_EMAIL,hash,"admin");
}
}
createAdmin();

app.get("/",(req,res)=>{
res.sendFile(__dirname+"/public/index.html");
});

app.get("/admin/login",(req,res)=>{
res.send(`
<h2>Admin Login</h2>
<form method="POST">
<input name="email"/>
<input name="password" type="password"/>
<button>Login</button>
</form>
`);
});

app.post("/admin/login",(req,res)=>{
const {email,password}=req.body;
const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
if(user && bcrypt.compareSync(password,user.password)){
req.session.user=user;
return res.redirect("/admin");
}
res.send("Login failed");
});

app.get("/admin",requireAuth,(req,res)=>{
const orders=db.prepare("SELECT * FROM orders").all();

let html="<h2>Orders</h2>";

orders.forEach(o=>{
html+=`<p>${o.name} - ${o.phone} - ${o.service}</p>`;
});

res.send(html);
});

app.post("/api/order",(req,res)=>{
const {name,phone,service}=req.body;

const id=nanoid();

db.prepare("INSERT INTO orders VALUES(?,?,?,?,?)")
.run(id,name,phone,service,new Date().toISOString());

sendWhatsApp(
`طلب جديد\nالاسم:${name}\nالهاتف:${phone}\nالخدمة:${service}`
);

res.json({ok:true});
});

app.listen(3000,()=>{
console.log("Achir Platform Running");
});
