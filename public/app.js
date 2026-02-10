async function loadServices() {
  const r = await fetch("/api/services");
  const j = await r.json();
  document.getElementById("title").textContent = j.siteName || "Achir Platform";

  const sel = document.getElementById("services");
  sel.innerHTML = "";
  j.services.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
}

document.getElementById("orderForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("msg");
  msg.textContent = "جار الإرسال...";

  const fd = new FormData(e.target);
  const body = Object.fromEntries(fd.entries());

  const r = await fetch("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) {
    msg.textContent = "تعذر الإرسال بالسيرفر";
    return;
  }

  msg.innerHTML = `تم ✅ رقم الطلب: ${j.order_id} — <a href="${j.whatsapp_url}" target="_blank">فتح واتساب</a>`;
});

loadServices();
