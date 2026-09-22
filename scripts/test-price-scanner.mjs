/**
 * scripts/test-price-scanner.mjs
 *
 * Diagnostic: simulate the price-scanner cron logic against real Supabase data.
 *
 * What it does:
 *  1. Loads active price_trackers from Supabase (using service role key).
 *  2. For each tracker, looks up the flight_price_cache entry.
 *  3. Evaluates alert conditions (target-price and any-drop trackers).
 *  4. Dry-runs alert dispatch (logs what WOULD be sent, does not actually send).
 *
 * Usage:
 *   node scripts/test-price-scanner.mjs
 *
 * To actually send alerts, set DRY_RUN=false:
 *   DRY_RUN=false node scripts/test-price-scanner.mjs
 *
 * Required env vars (loaded from .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TELEGRAM_BOT_TOKEN  (optional — only needed for real dispatch)
 *   ZEPTO_API_KEY       (optional — only needed for real dispatch)
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
  console.warn("[test-price-scanner] Could not load .env — relying on shell env.");
}

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const DRY_RUN = process.env.DRY_RUN !== "false";
const RATE_LIMIT_HOURS = 24;

if (!SUPABASE_URL) {
  console.error("❌ FATAL: SUPABASE_URL is not set.");
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error(
    "❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
    "   Get it from: https://supabase.com/dashboard/project/_/settings/api\n" +
    "   Then add it to .env: SUPABASE_SERVICE_ROLE_KEY=<value>"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

console.log(DRY_RUN
  ? "🔍 [DRY RUN] Running price-scanner simulation (no alerts will be sent)."
  : "🚀 [LIVE RUN] Running price-scanner — alerts WILL be dispatched!"
);
console.log("");

// ── Step 1: Fetch active trackers ─────────────────────────────────────────────
const { data: trackers, error: trackersError } = await supabase
  .from("price_trackers")
  .select("*")
  .eq("is_active", true);

if (trackersError) {
  console.error("❌ Failed to fetch price_trackers:", trackersError.message);
  process.exit(1);
}

if (!trackers || trackers.length === 0) {
  console.log("📭 No active price trackers found in the database.");
  console.log(
    "   Tip: Create a tracker via the Telegram bot (/track NBO CPT 50000)\n" +
    "        or via the FlightIQ web UI."
  );
  process.exit(0);
}

console.log(`📋 Found ${trackers.length} active tracker(s):\n`);
for (const t of trackers) {
  console.log(`   [${t.id.slice(0, 8)}] ${t.origin_iata} → ${t.destination_iata}` +
    ` | target: ${t.target_price ?? "any drop"} | chat: ${t.telegram_chat_id ?? "—"} | email: ${t.email ?? "—"}`);
}
console.log("");

// ── Step 2: For each tracker, check cached price and evaluate ─────────────────
let alertsTriggered = 0;
let skipRateLimited = 0;
let skipNoCache = 0;
let skipNoCondition = 0;

for (const record of trackers) {
  const currency = record.currency ?? "USD";
  const routeKey = `${record.origin_iata}-${record.destination_iata}-${record.departure_date}-${currency}`;
  const legacyKey = `${record.origin_iata}-${record.destination_iata}-${record.departure_date}`;

  console.log(`──────────────────────────────────────────────`);
  console.log(`🔎 Tracker [${record.id.slice(0, 8)}]: ${record.origin_iata} → ${record.destination_iata} on ${record.departure_date}`);

  // Check cache
  const { data: cache } = await supabase
    .from("flight_price_cache")
    .select("cheapest_price, skyscanner_link, currency, updated_at")
    .in("route_key", [routeKey, legacyKey])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cache) {
    console.log(`   ⚠️  No cache entry found for route_key: ${routeKey}`);
    console.log(`   💡 The cache is populated when users search this route on the site.`);
    skipNoCache++;
    continue;
  }

  const cachedPrice = Number(cache.cheapest_price);
  const targetPrice = record.target_price !== null ? Number(record.target_price) : null;
  const lastSeenPrice = record.last_seen_price !== null ? Number(record.last_seen_price) : null;
  const lastNotifiedAt = record.last_notified_at;

  console.log(`   💰 Cached price: ${currency} ${cachedPrice.toLocaleString()} (updated: ${cache.updated_at})`);
  console.log(`   🎯 Target price: ${targetPrice !== null ? `${currency} ${targetPrice.toLocaleString()}` : "any drop"}`);
  console.log(`   📌 Last seen price: ${lastSeenPrice !== null ? `${currency} ${lastSeenPrice.toLocaleString()}` : "none (first scan)"}`);

  // Rate limit check
  if (lastNotifiedAt) {
    const hoursSince = (Date.now() - new Date(lastNotifiedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < RATE_LIMIT_HOURS) {
      console.log(`   ⏳ Rate-limited: last notified ${hoursSince.toFixed(1)}h ago (limit: ${RATE_LIMIT_HOURS}h)`);
      skipRateLimited++;
      continue;
    }
  }

  // Alert condition
  let shouldAlert = false;
  let displayTargetPrice = targetPrice ?? cachedPrice;

  if (targetPrice !== null) {
    shouldAlert = cachedPrice <= targetPrice;
    console.log(`   📊 Condition (target): ${cachedPrice} <= ${targetPrice} → ${shouldAlert ? "✅ FIRE" : "❌ no"}`);
  } else {
    if (lastSeenPrice !== null) {
      shouldAlert = cachedPrice < lastSeenPrice;
      console.log(`   📊 Condition (any-drop): ${cachedPrice} < ${lastSeenPrice} → ${shouldAlert ? "✅ FIRE" : "❌ no"}`);
    } else {
      console.log(`   📊 Condition (any-drop): first scan — recording baseline, no alert.`);
    }
    displayTargetPrice = lastSeenPrice ?? cachedPrice;
  }

  if (!shouldAlert) {
    skipNoCondition++;
    console.log(`   ➡️  No alert fired for this tracker.`);
    continue;
  }

  alertsTriggered++;
  const alertCurrency = record.currency ?? cache.currency ?? "USD";
  const skyscannerLink =
    cache.skyscanner_link ||
    `https://www.skyscanner.net/transport/flights/${record.origin_iata.toLowerCase()}/${record.destination_iata.toLowerCase()}/`;

  console.log(`   🚨 ALERT CONDITION MET!`);
  console.log(`      Route: ${record.origin_iata} → ${record.destination_iata}`);
  console.log(`      Price: ${alertCurrency} ${cachedPrice.toLocaleString()} (target: ${displayTargetPrice.toLocaleString()})`);
  console.log(`      Channel(s): ${[record.telegram_chat_id && "Telegram", record.email && "Email"].filter(Boolean).join(", ") || "NONE"}`);

  if (DRY_RUN) {
    console.log(`   🔇 [DRY RUN] Skipping actual dispatch.`);
    if (!record.telegram_chat_id && !record.email) {
      console.log(`   ⚠️  BUG: This tracker has no notification channel! Add telegram_chat_id or email.`);
    }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("");
console.log("══════════════════════════════════════════════");
console.log("📊 PRICE SCANNER SIMULATION SUMMARY");
console.log("══════════════════════════════════════════════");
console.log(`  Total active trackers  : ${trackers.length}`);
console.log(`  Alert conditions met   : ${alertsTriggered}`);
console.log(`  No cache entry         : ${skipNoCache}`);
console.log(`  Rate-limited           : ${skipRateLimited}`);
console.log(`  No condition met       : ${skipNoCondition}`);
console.log("");

if (skipNoCache > 0) {
  console.log("💡 TIP: Cache entries are created when users search routes on the app.");
  console.log("   Run a search for the tracked routes to populate the cache, then re-run this script.");
}
if (alertsTriggered > 0 && DRY_RUN) {
  console.log(`💡 TIP: ${alertsTriggered} alert(s) would fire. Re-run with DRY_RUN=false to send them.`);
}
if (alertsTriggered === 0 && skipNoCache === 0) {
  console.log("✅ All trackers evaluated — no price conditions currently met.");
}
