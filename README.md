# منصة أشير V2 — ترقية مباشرة

✅ الجديد:
- حسابات زبائن:
  - إنشاء حساب: `/signup`
  - دخول زبون: `/customer/login`
  - صفحة حساب الزبون: `/account` (إنشاء طلب + متابعة الطلبات)
- الدفع (يدوي):
  - اختيار طريقة الدفع: CCP / بنك / نقداً
  - مرجع دفع اختياري (رقم وصل/حوالة)
  - API لتعليم الطلب "مدفوع": POST `/api/admin/orders/:id/pay` (يتطلب دخول admin)
- إدارة الباقات من لوحة الإدارة:
  - `/admin/services` (إضافة/تعديل/إخفاء)

## التشغيل
```bash
npm install
npm start
```

## روابط
- الموقع: `http://localhost:3000`
- إنشاء حساب: `http://localhost:3000/signup`
- دخول زبون: `http://localhost:3000/customer/login`
- حسابي: `http://localhost:3000/account`
- لوحة الإدارة: `http://localhost:3000/admin`
- إدارة الباقات: `http://localhost:3000/admin/services`

## بيانات المشرف
افتراضياً:
- email: admin@example.com
- password: Admin12345!

غيّرها من `.env` (انسخ `.env.example`).

## واتساب
حاليا النظام يُرجع رابط واتساب جاهز للفتح. للإرسال التلقائي لازم مزود رسمي (WhatsApp Business API / Twilio).
