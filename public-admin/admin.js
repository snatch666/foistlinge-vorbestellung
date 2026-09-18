(async function () {
  const tbody = document.getElementById("orders-body");

  try {
    const res = await fetch("/api/admin/orders");
    if (!res.ok) throw new Error("Fehler beim Laden");
    const data = await res.json();

    document.getElementById("stat-count").textContent = data.count;
    document.getElementById("stat-revenue").textContent =
      data.totalRevenue.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ` ${data.currency}`;

    if (data.orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">Noch keine Bestellungen.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.orders
      .map((o) => {
        const date = new Date(o.date).toLocaleString("de-DE");
        const address = [o.addressLine1, o.addressLine2, `${o.postalCode} ${o.city}`, o.country]
          .filter(Boolean)
          .join(", ");
        return `<tr>
          <td>${date}</td>
          <td>${escapeHtml(o.buyerName || o.shippingName || "")}</td>
          <td>${escapeHtml(o.email)}</td>
          <td>${escapeHtml(address)}</td>
          <td>${Number(o.amount).toFixed(2)} ${o.currency}</td>
        </tr>`;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Fehler beim Laden der Bestellungen.</td></tr>`;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }
})();
