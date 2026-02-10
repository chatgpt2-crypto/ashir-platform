// =============================
// Achir Platform Server
// Telegram + WhatsApp Ready
// =============================

const express = require("express");
const path = require("path");

const app = express();

// =============================
// إعداد Telegram (ضع التوكن)
// =============================
const TG_BOT_TOKEN = "8255304129:AAGjw36VLV4mrU_oD9rI3Dxv8AHoEKK_6eg";
const TG_CHAT_ID = "5993617651";

// =============================
// رقم WhatsApp
// =============================
const WHATSAPP_NUMBER = "213666376417"; // بدون صفر في البداية

// =============================
// Middleware
// =============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// عرض الموقع
app.use(express.static(path.join(__dirname, "public")));

// =============================
// Telegram Function
// =============================
async function sendTelegram(text) {
  try {
    const fetch = (await import("node-fetch")).default;

    await fetch(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TG_CHAT_ID,
          text: text,
        }),
      }
    );

    console.log("Telegram sent");
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

// =============================
// Submit Request
// =============================
app.post("/api/request", async (req, res) => {
  const { name, phone, service } = req.body;

  const message = `
طلب جديد من منصة أشير

الاسم: ${name}
الهاتف: ${phone}
الخدمة: ${service}
الوقت: ${new Date().toLocaleString()}
`;

  // إرسال Telegram
  await sendTelegram(message);

  // إنشاء رابط WhatsApp
  const whatsappURL =
    "https://wa.me/" +
    WHATSAPP_NUMBER +
    "?text=" +
    encodeURIComponent(message);

  // إعادة رابط WhatsApp
  res.json({
    success: true,
    whatsapp: whatsappURL,
  });
});

// =============================
// Admin Panel
// =============================
app.get("/admin", (req, res) => {
  res.send(`
  <html>
  <head>
  <title>لوحة الإدارة</title>
  <style>
  body{
    background:#0f172a;
    color:white;
    font-family:Arial;
    padding:30px;
  }
  .box{
    background:#1e293b;
    padding:20px;
    border-radius:10px;
  }
  </style>
  </head>
  <body>
  <div class="box">
  <h2>لوحة الإدارة</h2>
  <p>Telegram مفعل</p>
  <p>WhatsApp مفعل</p>
  </div>
  </body>
  </html>
  `);
});

// =============================
// تشغيل السيرفر
// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
