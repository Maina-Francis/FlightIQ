/**
 * scripts/test-zepto.mjs
 *
 * Diagnostic: send a test price-drop email via ZeptoMail.
 *
 * Usage:
 *   node scripts/test-zepto.mjs
 *
 * Required env vars (loaded from .env by the script itself):
 *   ZEPTO_API_KEY   – must be the raw API key string WITHOUT the
 *                     "Zoho-enczapikey " prefix (the code adds it).
 *
 * Override the recipient by setting TEST_EMAIL:
 *   TEST_EMAIL=you@example.com node scripts/test-zepto.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load .env manually (no external dep required) ─────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  console.warn("[test-zepto] Could not load .env — relying on shell env.");
}

// ── Config ────────────────────────────────────────────────────────────────────
const RAW_ZEPTO_KEY = process.env.ZEPTO_API_KEY ?? "";
const TEST_EMAIL = process.env.TEST_EMAIL ?? "alerts-test@flightiq.app";

// Defensive: strip any accidental prefix duplication that may have crept into .env
const CLEAN_KEY = RAW_ZEPTO_KEY.replace(/^Zoho-enczapikey\s+/i, "").trim();

if (!CLEAN_KEY) {
  console.error(
    "❌ FATAL: ZEPTO_API_KEY is not set. Add it to .env and retry."
  );
  process.exit(1);
}

// ── Mock payload ──────────────────────────────────────────────────────────────
const payload = {
  email: TEST_EMAIL,
  originIata: "NBO",
  destinationIata: "CPT",
  currency: "USD",
  newPrice: 42000,
  targetPrice: 50000,
  departureDate: "2026-10-15",
  skyscannerLink:
    "https://www.skyscanner.net/transport/flights/nbo/cpt/261015/",
};

// ── Email body ────────────────────────────────────────────────────────────────
const htmlbody = `
  <h2>🚨 Price Drop Alert! [DIAGNOSTIC TEST]</h2>
  <p>A fare you're tracking has dropped below your target price:</p>
  <ul>
    <li><strong>Route:</strong> ${payload.originIata} ✈️ ${payload.destinationIata}</li>
    <li><strong>New Fare:</strong> ${payload.currency} ${payload.newPrice.toLocaleString()}</li>
    <li><strong>Your Target:</strong> ${payload.currency} ${payload.targetPrice.toLocaleString()}</li>
    <li><strong>Departure:</strong> ${payload.departureDate}</li>
  </ul>
  <p>
    <a href="${payload.skyscannerLink}"
       style="background:#0770e3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
      Book on Skyscanner →
    </a>
  </p>
  <p style="font-size:12px;color:#888;">
    ⚠️ This is an automated diagnostic test from the FlightIQ scripts suite.
  </p>
`;

// ── Send ──────────────────────────────────────────────────────────────────────
console.log("[test-zepto] Sending test email to:", TEST_EMAIL);
console.log("[test-zepto] Key prefix being used: Zoho-enczapikey (key length:", CLEAN_KEY.length, ")");

const res = await fetch("https://api.zeptomail.com/v1.1/email", {
  method: "POST",
  headers: {
    Authorization: `Zoho-enczapikey ${CLEAN_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: { address: "alerts@flightiq.app", name: "FlightIQ Alerts" },
    to: [{ email_address: { address: payload.email } }],
    subject: `[TEST] ✈️ Price Drop: ${payload.originIata} → ${payload.destinationIata} — ${payload.currency} ${payload.newPrice.toLocaleString()}`,
    htmlbody,
  }),
});

const responseText = await res.text();

if (res.ok) {
  console.log("✅ ZeptoMail: email sent successfully!");
  console.log("   HTTP Status:", res.status);
  try {
    console.log("   Response body:", JSON.parse(responseText));
  } catch {
    console.log("   Response body:", responseText.slice(0, 300));
  }
} else {
  console.error("❌ ZeptoMail send FAILED");
  console.error("   HTTP Status:", res.status);
  console.error("   Response body:", responseText.slice(0, 500));
  process.exit(1);
}
