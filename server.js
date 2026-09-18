const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const QRCode = require("qrcode");
const ExcelJS = require("exceljs");

const { createOrder, captureOrder } = require("./lib/paypal");
const { readAll, addOrder } = require("./lib/orders");
const { basicAuth } = require("./lib/auth");

const app = express();
app.use(express.json());

const basePrice = Number(process.env.ALBUM_PRICE || "18.00");
const shipping = Number(process.env.ALBUM_SHIPPING || "6.00");

const ALBUM = {
  band: "Foistlinge",
  title: "Hymnen für Trinker",
  basePrice: basePrice.toFixed(2),
  shipping: shipping.toFixed(2),
  price: (basePrice + shipping).toFixed(2),
  currency: process.env.ALBUM_CURRENCY || "EUR",
  description: "Foistlinge – Hymnen für Trinker (Vinyl-Vorbestellung, inkl. digitalem Album & Versand)",
};

app.get("/health", (req, res) => res.type("text/plain").send("ok"));

// --- Oeffentliche Landingpage & Assets ---
app.use(express.static(path.join(__dirname, "public")));

app.get("/config.js", (req, res) => {
  res.type("application/javascript").send(
    `window.PAYPAL_CLIENT_ID = ${JSON.stringify(process.env.PAYPAL_CLIENT_ID || "")};\n` +
      `window.ALBUM = ${JSON.stringify(ALBUM)};\n`
  );
});

// QR-Code zeigt immer auf die aktuell aufgerufene Basis-URL,
// funktioniert also automatisch nach jedem Deploy / Domainwechsel.
app.get("/qr.png", async (req, res) => {
  const targetUrl = `${req.protocol}://${req.get("host")}/`;
  res.type("png");
  QRCode.toFileStream(res, targetUrl, { width: 500, margin: 2 });
});

// --- PayPal Checkout ---
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const order = await createOrder({
      amount: ALBUM.price,
      currency: ALBUM.currency,
      description: ALBUM.description,
    });
    res.json({ id: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PayPal-Bestellung konnte nicht erstellt werden." });
  }
});

app.post("/api/paypal/capture-order/:orderID", async (req, res) => {
  try {
    const capture = await captureOrder(req.params.orderID);

    if (capture.status !== "COMPLETED") {
      return res.status(400).json({ error: "Zahlung nicht abgeschlossen.", capture });
    }

    const purchaseUnit = capture.purchase_units?.[0] || {};
    const paymentCapture = purchaseUnit.payments?.captures?.[0] || {};
    const shipping = purchaseUnit.shipping || {};
    const address = shipping.address || {};
    const payer = capture.payer || {};

    const order = {
      id: paymentCapture.id || capture.id,
      paypalOrderId: capture.id,
      date: new Date().toISOString(),
      buyerName: [payer.name?.given_name, payer.name?.surname].filter(Boolean).join(" ") || shipping.name?.full_name || "",
      shippingName: shipping.name?.full_name || "",
      email: payer.email_address || "",
      addressLine1: address.address_line_1 || "",
      addressLine2: address.address_line_2 || "",
      postalCode: address.postal_code || "",
      city: address.admin_area_2 || "",
      region: address.admin_area_1 || "",
      country: address.country_code || "",
      amount: paymentCapture.amount?.value || ALBUM.price,
      currency: paymentCapture.amount?.currency_code || ALBUM.currency,
      status: capture.status,
    };

    await addOrder(order);
    res.json({ status: "ok", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Zahlung konnte nicht abgeschlossen werden." });
  }
});

// --- Admin-Bereich (passwortgeschuetzt) ---
app.use("/admin", basicAuth, express.static(path.join(__dirname, "public-admin")));

app.get("/api/admin/orders", basicAuth, async (req, res) => {
  const orders = (await readAll()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  res.json({ count: orders.length, totalRevenue, currency: ALBUM.currency, orders });
});

app.get("/api/admin/export", basicAuth, async (req, res) => {
  const orders = (await readAll()).sort((a, b) => new Date(b.date) - new Date(a.date));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Bestellungen");
  sheet.columns = [
    { header: "Datum", key: "date", width: 22 },
    { header: "Name", key: "buyerName", width: 24 },
    { header: "E-Mail", key: "email", width: 28 },
    { header: "Adresse", key: "addressLine1", width: 28 },
    { header: "Adresszusatz", key: "addressLine2", width: 20 },
    { header: "PLZ", key: "postalCode", width: 10 },
    { header: "Ort", key: "city", width: 20 },
    { header: "Region", key: "region", width: 16 },
    { header: "Land", key: "country", width: 8 },
    { header: "Betrag", key: "amount", width: 10 },
    { header: "Waehrung", key: "currency", width: 10 },
    { header: "PayPal-Order-ID", key: "paypalOrderId", width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };

  orders.forEach((o) => {
    sheet.addRow({
      ...o,
      date: new Date(o.date).toLocaleString("de-DE"),
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="vorbestellungen-${new Date().toISOString().slice(0, 10)}.xlsx"`
  );
  await workbook.xlsx.write(res);
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server laeuft auf http://localhost:${PORT}`);
  console.log(`Admin-Bereich: http://localhost:${PORT}/admin`);
});
