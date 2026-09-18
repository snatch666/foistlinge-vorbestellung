const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");

const USE_DB = Boolean(process.env.DATABASE_URL);

let pool;
let tableReady;

if (USE_DB) {
  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  tableReady = pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      paypal_order_id TEXT UNIQUE NOT NULL,
      date TIMESTAMPTZ NOT NULL,
      buyer_name TEXT,
      shipping_name TEXT,
      email TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      postal_code TEXT,
      city TEXT,
      region TEXT,
      country TEXT,
      amount NUMERIC,
      currency TEXT,
      status TEXT
    )
  `);
}

// --- Datei-basierter Speicher (Fallback ohne DATABASE_URL) ---

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readAllFile() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAllFile(orders) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), "utf8");
}

// --- Postgres-Speicher (aktiv, wenn DATABASE_URL gesetzt ist) ---

function rowToOrder(row) {
  return {
    id: row.id,
    paypalOrderId: row.paypal_order_id,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    buyerName: row.buyer_name || "",
    shippingName: row.shipping_name || "",
    email: row.email || "",
    addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || "",
    postalCode: row.postal_code || "",
    city: row.city || "",
    region: row.region || "",
    country: row.country || "",
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
  };
}

async function readAllDb() {
  await tableReady;
  const { rows } = await pool.query("SELECT * FROM orders ORDER BY date DESC");
  return rows.map(rowToOrder);
}

async function addOrderDb(order) {
  await tableReady;
  await pool.query(
    `INSERT INTO orders (
       id, paypal_order_id, date, buyer_name, shipping_name, email,
       address_line1, address_line2, postal_code, city, region, country,
       amount, currency, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (paypal_order_id) DO NOTHING`,
    [
      order.id,
      order.paypalOrderId,
      order.date,
      order.buyerName,
      order.shippingName,
      order.email,
      order.addressLine1,
      order.addressLine2,
      order.postalCode,
      order.city,
      order.region,
      order.country,
      order.amount,
      order.currency,
      order.status,
    ]
  );
}

// --- Oeffentliche API (immer async, unabhaengig vom Speicher) ---

async function readAll() {
  if (USE_DB) return readAllDb();
  return readAllFile();
}

async function addOrder(order) {
  if (USE_DB) return addOrderDb(order);
  const orders = readAllFile();
  const alreadyExists = orders.some((o) => o.paypalOrderId === order.paypalOrderId);
  if (alreadyExists) return;
  orders.push(order);
  writeAllFile(orders);
}

module.exports = { readAll, addOrder };
