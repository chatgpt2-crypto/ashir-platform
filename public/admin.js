const body = document.getElementById("ordersBody");
const statusEl = document.getElementById("status");
const refreshBtn = document.getElementById("refreshBtn");

async function loadOrders() {
  statusEl.textContent = "تحميل...";
  try {
    const res = await fetch("/api/orders"); // سيطلب المتصفح Login تلقائياً
    const data = await res.json();

    if (!data.ok) throw new Error("not ok");

    const orders = data.orders || [];
    statusEl.textContent = `عدد الطلبات: ${orders.length}`;

    if (!orders.length) {
      body.innerHTML = `<tr><td colspan="6" class="muted">لا توجد طلبات</td></tr>`;
      return;
    }

    body.innerHTML = orders.map(o => `
      <tr>
        <td>${new Date(o.time).toLocaleString()}</td>
        <td>${escapeHtml(o.service)}</td>
        <td>${escapeHtml(o.phone)}</td>
        <td>${escapeHtml(o.name)}</td>
        <td>${escapeHtml(o.notes || "-")}</td>
        <td><button class="btn danger" data-id="${o.id}">حذف</button></td>
      </tr>
    `).join("");

  } catch (e) {
    statusEl.textContent = "فشل التحميل";
    body.innerHTML = `<tr><td colspan="6" class="muted">تعذر تحميل الطلبات (تحقق من بيانات الدخول)</td></tr>`;
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

body.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  if (!confirm("حذف الطلب؟")) return;

  try {
    await fetch(`/api/orders/${id}`, { method: "DELETE" });
    loadOrders();
  } catch {}
});

refreshBtn.addEventListener("click", loadOrders);

loadOrders();
