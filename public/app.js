const form = document.getElementById("orderForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  msg.className = "msg";

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  try {
    const res = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.ok) {
      msg.textContent = "تعذر حفظ الطلب في السيرفر ❌";
      msg.classList.add("err");
      return;
    }

    msg.textContent = "تم حفظ الطلب ✅ سيتم فتح واتساب الآن...";
    msg.classList.add("ok");

    setTimeout(() => {
      window.open(data.waLink, "_blank");
      form.reset();
    }, 700);

  } catch (err) {
    msg.textContent = "تعذر الاتصال بالسيرفر ❌";
    msg.classList.add("err");
  }
});
