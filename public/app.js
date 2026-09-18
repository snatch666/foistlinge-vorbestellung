(function () {
  const statusEl = document.getElementById("status");

  function showStatus(kind, text) {
    statusEl.className = `status show ${kind}`;
    statusEl.textContent = text;
  }

  function formatEuro(value) {
    return Number(value).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (window.ALBUM) {
    document.getElementById("price-display").textContent = `${formatEuro(window.ALBUM.price)} €`;
    document.getElementById("price-sub").textContent =
      `inkl. ${formatEuro(window.ALBUM.shipping)} € Versand – direkt mit PayPal bezahlen`;
  }

  if (!window.PAYPAL_CLIENT_ID) {
    showStatus(
      "error",
      "PayPal ist noch nicht konfiguriert (PAYPAL_CLIENT_ID fehlt in der .env-Datei)."
    );
    return;
  }

  const sdkScript = document.createElement("script");
  sdkScript.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
    window.PAYPAL_CLIENT_ID
  )}&currency=${encodeURIComponent(window.ALBUM.currency)}&intent=capture&disable-funding=sepa,credit,paylater`;
  sdkScript.onload = renderButtons;
  sdkScript.onerror = () =>
    showStatus("error", "PayPal-SDK konnte nicht geladen werden.");
  document.head.appendChild(sdkScript);

  function renderButtons() {
    paypal
      .Buttons({
        style: { layout: "vertical", color: "gold", label: "paypal", height: 48 },

        createOrder: function () {
          showStatus("pending", "Bestellung wird vorbereitet …");
          return fetch("/api/paypal/create-order", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
              if (data.error) throw new Error(data.error);
              return data.id;
            })
            .catch((err) => {
              showStatus("error", "Fehler beim Start der Bezahlung: " + err.message);
              throw err;
            });
        },

        onApprove: function (data) {
          showStatus("pending", "Zahlung wird bestätigt …");
          return fetch(`/api/paypal/capture-order/${data.orderID}`, {
            method: "POST",
          })
            .then((res) => res.json())
            .then((result) => {
              if (result.error) throw new Error(result.error);
              showStatus(
                "success",
                "Danke! Deine Vorbestellung ist eingegangen. Wir versenden ca. am 10. Oktober 2026."
              );
            })
            .catch((err) => {
              showStatus("error", "Zahlung erhalten, aber Bestätigung fehlgeschlagen: " + err.message);
            });
        },

        onError: function (err) {
          console.error(err);
          showStatus("error", "Bei der Zahlung ist ein Fehler aufgetreten. Bitte versuch es erneut.");
        },

        onCancel: function () {
          showStatus("pending", "Zahlung abgebrochen.");
        },
      })
      .render("#paypal-button-container");
  }
})();
