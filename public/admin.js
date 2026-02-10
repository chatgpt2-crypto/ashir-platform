async function load() {
  const s = await fetch("/api/admin/status");
  const sj = await s.json();
  document.getElementById("status").innerHTML =
    `<div style="line-height:2">
      <div>Telegram: <b>${sj.telegram}</b></div>
      <div>WhatsApp: <b>${sj.whatsapp}</b> (${sj.whatsappNumber})</div>
    </div>`;

  const r = await fetch("/api/admin/orders");
  const j = await r.json();
  const tb = document.getElementById("rows");
  tb.innerHTML = "";

  j.orders.forEach(o => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${o.id}</td>
      <td>${o.customer_name}</td>
      <td>${o.phone}</td>
      <td>${o.service_name}</td>
      <td>${(o.note || "").replaceAll("<","&lt;")}</td>
      <td>${o.created_at}</td>
    `;
    tb.appendChild(tr);
  });
}

load();
