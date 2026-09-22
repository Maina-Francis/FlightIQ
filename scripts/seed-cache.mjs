/**
 * scripts/seed-cache.mjs
 *
 * Populates flight_price_cache for all active price_tracker routes
 * that currently have no cached entry. Fetches live fares from the
 * Travelpayouts (Aviasales) API and writes them directly to Supabase.
 *
 * Run this once to bootstrap the cache before price-scanner can fire.
 *
 * Usage:
 *   node scripts/seed-cache.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ── Load .env ─────────────────────────────────────────────────────────────────
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
  console.warn("[seed-cache] Could not load .env — relying on shell env.");
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const TP_TOKEN = process.env.TRAVELPAYOUTS_TOKEN ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ FATAL: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.");
  process.exit(1);
}
if (!TP_TOKEN) {
  console.error("❌ FATAL: TRAVELPAYOUTS_TOKEN not set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchLowestFare(origin, destination, depDate, currency) {
  const cur = (currency ?? "usd").toLowerCase();
  // Supported currencies by Aviasales: usd, eur, rub, kzt, uah, pln
  // KES is not supported — fall back to USD
  const safeCur = ["usd", "eur", "rub", "kzt", "uah", "pln"].includes(cur) ? cur : "usd";

  const monthStr = depDate.slice(0, 7);
  const attempts = [
    // Tier 1: exact date
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&destination=${destination}&departure_at=${depDate}&currency=${safeCur}&sorting=price&limit=10&token=${TP_TOKEN}`,
    // Tier 2: month
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=${origin}&destination=${destination}&departure_at=${monthStr}&currency=${safeCur}&sorting=price&limit=10&token=${TP_TOKEN}`,
  ];

  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        return { price: json.data[0].price, currency: safeCur.toUpperCase(), tier: attempts.indexOf(url) + 1 };
      }
    } catch { /* continue */ }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];

// 1. Fetch all active trackers
const { data: trackers, error } = await supabase
  .from("price_trackers")
  .select("id, origin_iata, destination_iata, departure_date, currency, is_active")
  .eq("is_active", true);

if (error) {
  console.error("❌ Failed to read price_trackers:", error.message);
  process.exit(1);
}

if (!trackers || trackers.length === 0) {
  console.log("📭 No active trackers found. Nothing to seed.");
  process.exit(0);
}

console.log(`🌱 Seeding cache for ${trackers.length} active tracker(s)...\n`);

let seeded = 0;
let skipped = 0;

for (const t of trackers) {
  const currency = t.currency ?? "USD";
  const routeKey = `${t.origin_iata}-${t.destination_iata}-${t.departure_date}-${currency}`;

  // Skip past departure dates
  if (t.departure_date < today) {
    console.log(`⏭️  [${t.origin_iata}→${t.destination_iata}] Departure ${t.departure_date} is in the past — deactivating tracker.`);
    await supabase.from("price_trackers").update({ is_active: false }).eq("id", t.id);
    skipped++;
    continue;
  }

  // Check if already cached
  const { data: existing } = await supabase
    .from("flight_price_cache")
    .select("cheapest_price, updated_at")
    .eq("route_key", routeKey)
    .maybeSingle();

  if (existing) {
    console.log(`✅ [${t.origin_iata}→${t.destination_iata}] Already cached: ${currency} ${existing.cheapest_price} (updated: ${existing.updated_at})`);
    skipped++;
    continue;
  }

  // Fetch from Travelpayouts
  console.log(`🔍 [${t.origin_iata}→${t.destination_iata}] Fetching fares for ${t.departure_date}...`);
  const fare = await fetchLowestFare(t.origin_iata, t.destination_iata, t.departure_date, currency);

  if (!fare) {
    console.log(`   ⚠️  No fares found for ${t.origin_iata}→${t.destination_iata} on ${t.departure_date}.`);
    console.log(`      Note: KES is not supported by Aviasales API — prices returned in USD.`);
    skipped++;
    continue;
  }

  const skyscannerLink = `https://www.skyscanner.net/transport/flights/${t.origin_iata.toLowerCase()}/${t.destination_iata.toLowerCase()}/`;

  const { error: upsertErr } = await supabase
    .from("flight_price_cache")
    .upsert({
      route_key: routeKey,
      cheapest_price: fare.price,
      currency: fare.currency,
      skyscanner_link: skyscannerLink,
      updated_at: new Date().toISOString(),
    }, { onConflict: "route_key" });

  if (upsertErr) {
    console.log(`   ❌ Upsert failed: ${upsertErr.message}`);
  } else {
    console.log(`   ✅ Cached: ${fare.currency} ${fare.price} (Tier ${fare.tier})`);
    seeded++;
  }
}

console.log(`\n📊 Done: ${seeded} route(s) seeded, ${skipped} skipped/deactivated.`);
if (seeded > 0) {
  console.log(`\n💡 Now run: npm run test:price-scanner\n   to verify the scanner can read the newly cached prices.`);
}
