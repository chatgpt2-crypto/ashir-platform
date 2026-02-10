const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));

const DB_FILE = "orders.json";

// إنشاء ملف إذا لم يوجد
if (!fs.existsSync(DB_FILE)) {
fs.writeFileSync(DB_FILE, "[]");
}

// حفظ طلب
app.post("/api/order", (req, res) => {

const orders = JSON.parse(fs.readFileSync(DB_FILE));

const newOrder = {
name: req.body.name,
phone: req.body.phone,
service: req.body.service,
date: new Date().toLocaleString()
};

orders.push(newOrder);

fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));

res.json({success:true});

});

// عرض الطلبات
app.get("/api/orders", (req, res) => {

const orders = JSON.parse(fs.readFileSync(DB_FILE));

res.json(orders);

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
console.log("Server running");
});
