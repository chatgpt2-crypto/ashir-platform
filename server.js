const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));

const DATA = path.join(__dirname,"orders.json");

if(!fs.existsSync(DATA)){
fs.writeFileSync(DATA,"[]");
}

function read(){
return JSON.parse(fs.readFileSync(DATA));
}

function save(data){
fs.writeFileSync(DATA,JSON.stringify(data,null,2));
}

app.post("/api/order",(req,res)=>{

const orders = read();

const order = {
id:Date.now().toString(),
date:new Date(),
name:req.body.name,
phone:req.body.phone,
service:req.body.service,
note:req.body.note
};

orders.push(order);

save(orders);

res.json({ok:true});

});

app.get("/api/orders",(req,res)=>{
res.json(read());
});

app.delete("/api/orders/:id",(req,res)=>{

let orders = read();

orders = orders.filter(o=>o.id!=req.params.id);

save(orders);

res.json({ok:true});

});

app.listen(3000,()=>{
console.log("Server running");
});
