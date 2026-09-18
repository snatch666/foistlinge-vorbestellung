const PAYPAL_ENV = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
const BASE_URL =
  PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET fehlen in der .env-Datei."
    );
  }
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal Token-Fehler (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function createOrder({ amount, currency, description }) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount },
          description,
        },
      ],
      application_context: {
        brand_name: "Foistlinge",
        shipping_preference: "GET_FROM_FILE",
        user_action: "PAY_NOW",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal createOrder-Fehler (${res.status}): ${text}`);
  }
  return res.json();
}

async function captureOrder(orderId) {
  const token = await getAccessToken();
  const res = await fetch(
    `${BASE_URL}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal captureOrder-Fehler (${res.status}): ${text}`);
  }
  return res.json();
}

module.exports = { createOrder, captureOrder, PAYPAL_ENV };
