/**
 * supabase/functions/price-scanner/index.ts
 *
 * Deno-native Supabase Edge Function — Price Scanner & Alert Dispatcher.
 *
 * Responsibilities:
 *  1. Fetch all active price trackers from `price_trackers`
 *  2. For each tracker, check the latest cached price in `flight_price_cache`
 *  3. Determine if an alert should fire:
 *     • Target-price tracker: fire when cached_price <= target_price
 *     • Any-drop tracker (target_price IS NULL): fire when cached_price < last_seen_price
 *       (i.e. the price actually dropped since the last scan)
 *  4. Rate-limit: skip if last_notified_at is within 24 hours
 *  5. Dispatch alerts via Telegram Bot API and/or ZeptoMail
 *  6. Update last_notified_at and last_seen_price (keep tracker active)
 *
 * Invoke manually:   supabase functions invoke price-scanner
 * Production cron:   configure via Supabase Dashboard → Edge Functions → Schedule
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
// Strip any accidental "Zoho-enczapikey " prefix — the Authorization header
// builder below adds it. Having it in the env var AND in the header causes a
// 401 "Invalid API key" error from ZeptoMail.
const ZEPTO_API_KEY = Deno.env.get("ZEPTO_API_KEY")
  ?.replace(/^Zoho-enczapikey\s+/i, "").trim() || undefined;
const SKYSCANNER_PARTNER_ID = Deno.env.get("VITE_SKYSCANNER_PARTNER_ID") ?? "";

const RATE_LIMIT_HOURS = 24;

// ─── CORS Headers (mandatory for Supabase edge functions) ────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Supabase Admin Client ────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Skyscanner Affiliate Deep Link ──────────────────────────────────────────

function buildSkyscannerLink(
  origin: string,
  destination: string,
  departureDate: string,
  currency: string,
): string {
  const [year, month, day] = departureDate.split("-");
  const compact = `${(year ?? "").slice(2)}${month ?? ""}${day ?? ""}`;

  const params = new URLSearchParams({
    adultsv2: "1",
    cabinclass: "economy",
    currency,
  });

  const destinationUrl = `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${compact}/?${params.toString()}`;
  if (!SKYSCANNER_PARTNER_ID) {
    return destinationUrl;
  }
  return `https://skyscanner.pxf.io/c/${SKYSCANNER_PARTNER_ID}/1219808/13404?u=${encodeURIComponent(destinationUrl)}`;
}

// ─── Telegram Dispatch ────────────────────────────────────────────────────────

async function sendTelegramAlert(opts: {
  chatId: string;
  originIata: string;
  destinationIata: string;
  currency: string;
  newPrice: number;
  targetPrice: number;
  departureDate: string;
  skyscannerLink: string;
}): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[price-scanner] TELEGRAM_BOT_TOKEN not set — skipping Telegram alert.");
    return false;
  }

  const text =
    `🚨 *PRICE DROP ALERT!*\n\n` +
    `✈️ *${opts.originIata}* ➔ *${opts.destinationIata}*\n` +
    `💰 New Low Fare: *${opts.currency} ${opts.newPrice.toLocaleString()}*\n` +
    `🎯 Your Target: *${opts.currency} ${opts.targetPrice.toLocaleString()}*\n` +
    `📅 Departure: ${opts.departureDate}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔗 Book on Skyscanner", url: opts.skyscannerLink }],
    ],
  };

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[price-scanner] Telegram sendMessage failed (${res.status}): ${body}`);
    return false;
  }

  console.log(`[price-scanner] Telegram alert sent to chat ${opts.chatId}`);
  return true;
}

// ─── Email Dispatch (ZeptoMail) ───────────────────────────────────────────────

async function sendEmailAlert(opts: {
  email: string;
  originIata: string;
  destinationIata: string;
  currency: string;
  newPrice: number;
  targetPrice: number;
  departureDate: string;
  skyscannerLink: string;
}): Promise<boolean> {
  if (!ZEPTO_API_KEY) {
    console.warn("[price-scanner] ZEPTO_API_KEY not set — skipping email alert.");
    return false;
  }

  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${ZEPTO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: "alerts@flightIQ.app", name: "FlightIQ Alerts" },
      to: [{ email_address: { address: opts.email } }],
      subject: `✈️ Price Drop: ${opts.originIata} → ${opts.destinationIata} — ${opts.currency} ${opts.newPrice.toLocaleString()}`,
      htmlbody: `
        <h2>🚨 Price Drop Alert!</h2>
        <p>A fare you're tracking has dropped below your target price:</p>
        <ul>
          <li><strong>Route:</strong> ${opts.originIata} ✈️ ${opts.destinationIata}</li>
          <li><strong>New Fare:</strong> ${opts.currency} ${opts.newPrice.toLocaleString()}</li>
          <li><strong>Your Target:</strong> ${opts.currency} ${opts.targetPrice.toLocaleString()}</li>
          <li><strong>Departure:</strong> ${opts.departureDate}</li>
        </ul>
        <p>
          <a href="${opts.skyscannerLink}" style="background:#0770e3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
            Book on Skyscanner →
          </a>
        </p>
        <p style="font-size:12px;color:#888;">You're receiving this because you set a fare alert on FlightIQ. Visit FlightIQ to manage your alerts.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[price-scanner] ZeptoMail send failed (${res.status}): ${body}`);
    return false;
  }

  console.log(`[price-scanner] Email alert sent to ${opts.email}`);
  return true;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[price-scanner] Starting price scan run...");

    // 1. Fetch all active price trackers
    const { data: trackers, error: trackersError } = await supabase
      .from("price_trackers")
      .select("*")
      .eq("is_active", true);

    if (trackersError) {
      console.error("[price-scanner] Failed to fetch trackers:", trackersError.message);
      return new Response(
        JSON.stringify({ error: trackersError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!trackers || trackers.length === 0) {
      console.log("[price-scanner] No active trackers found.");
      return new Response(
        JSON.stringify({ scanned: 0, alerted: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[price-scanner] Found ${trackers.length} active tracker(s).`);

    let alerted = 0;
    let skipped = 0;
    const updatePromises: Promise<unknown>[] = [];

    for (const record of trackers) {
      const currency = record.currency ?? "USD";
      const routeKey = `${record.origin_iata}-${record.destination_iata}-${record.departure_date}-${currency}`;
      const legacyRouteKey = `${record.origin_iata}-${record.destination_iata}-${record.departure_date}`;

      // 2. Look up cached price for this route
      const { data: cache } = await supabase
        .from("flight_price_cache")
        .select("cheapest_price, skyscanner_link, currency")
        .in("route_key", [routeKey, legacyRouteKey])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cache) {
        console.log(`[price-scanner] No cached price for route ${routeKey} — skipping.`);
        continue;
      }

      // 2b. Skip (and deactivate) trackers whose departure date has already passed
      // Use UTC date — Supabase Edge Functions run in UTC. Trackers are deactivated
      // once their departure_date is strictly before today's UTC date.
      const today = new Date().toISOString().split("T")[0]!;
      if (record.departure_date < today) {
        console.log(
          `[price-scanner] Tracker ${record.id} departure ${record.departure_date} is in the past — deactivating.`,
        );
        updatePromises.push(
          supabase
            .from("price_trackers")
            .update({ is_active: false })
            .eq("id", record.id),
        );
        continue;
      }

      const cachedPrice = Number(cache.cheapest_price);
      const targetPrice = record.target_price !== null ? Number(record.target_price) : null;
      const lastSeenPrice = record.last_seen_price !== null ? Number(record.last_seen_price) : null;
      const lastNotifiedAt = record.last_notified_at;

      // 3. Rate-limit: skip if notified within the last 24 hours
      if (lastNotifiedAt) {
        const hoursSinceLastNotification =
          (Date.now() - new Date(lastNotifiedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastNotification < RATE_LIMIT_HOURS) {
          console.log(
            `[price-scanner] Tracker ${record.id} notified ${hoursSinceLastNotification.toFixed(1)}h ago — rate-limited.`,
          );
          skipped++;
          // Still update last_seen_price so the next scan has a baseline
          updatePromises.push(
            supabase
              .from("price_trackers")
              .update({ last_seen_price: cachedPrice })
              .eq("id", record.id),
          );
          continue;
        }
      }

      // 4. Determine if an alert should fire
      let shouldAlert = false;
      let displayTargetPrice = targetPrice ?? cachedPrice;

      if (targetPrice !== null) {
        // Target-price tracker: fire when cached price <= target
        shouldAlert = cachedPrice <= targetPrice;
      } else {
        // Any-drop tracker: fire only when the price actually dropped
        // (current < previous) and there IS a previous price to compare against.
        // First scan (lastSeenPrice === null) just records the baseline, no alert.
        if (lastSeenPrice !== null) {
          shouldAlert = cachedPrice < lastSeenPrice;
          // Show the previous (higher) price as the "target" so the message reads
          // "dropped from X to Y" rather than showing the same price twice.
          displayTargetPrice = lastSeenPrice;
        }
        // If there is no lastSeenPrice yet this is the first scan — displayTargetPrice
        // remains cachedPrice as initialised above; no alert fires.
      }

      if (!shouldAlert) {
        console.log(`[price-scanner] Route ${routeKey}: no alert condition met.`);
        // Update last_seen_price so future scans can detect drops
        updatePromises.push(
          supabase
            .from("price_trackers")
            .update({ last_seen_price: cachedPrice })
            .eq("id", record.id),
        );
        continue;
      }

      const alertCurrency = record.currency ?? cache.currency ?? "USD";
      const skyscannerLink =
        cache.skyscanner_link ||
        buildSkyscannerLink(
          record.origin_iata,
          record.destination_iata,
          record.departure_date,
          alertCurrency,
        );

      const alertOpts = {
        originIata: record.origin_iata,
        destinationIata: record.destination_iata,
        currency: alertCurrency,
        newPrice: cachedPrice,
        targetPrice: displayTargetPrice,
        departureDate: record.departure_date,
        skyscannerLink,
      };

      // 5. Dispatch alerts
      let alertSent = false;

      if (record.telegram_chat_id) {
        const ok = await sendTelegramAlert({ chatId: record.telegram_chat_id, ...alertOpts });
        if (ok) alertSent = true;
      }

      if (record.email) {
        const ok = await sendEmailAlert({ email: record.email, ...alertOpts });
        if (ok) alertSent = true;
      }

      if (alertSent) {
        alerted++;
        // 6. Update last_notified_at and last_seen_price (keep tracker active)
        updatePromises.push(
          supabase
            .from("price_trackers")
            .update({
              last_notified_at: new Date().toISOString(),
              last_seen_price: cachedPrice,
            })
            .eq("id", record.id),
        );
      } else {
        // No alert was sent (missing secrets, API failure) — still update last_seen_price
        updatePromises.push(
          supabase
            .from("price_trackers")
            .update({ last_seen_price: cachedPrice })
            .eq("id", record.id),
        );
      }
    }

    // Wait for all tracker updates to complete
    await Promise.all(updatePromises);

    console.log(
      `[price-scanner] Scan complete. Alerted: ${alerted}/${trackers.length}, rate-limited: ${skipped}.`,
    );

    return new Response(
      JSON.stringify({ scanned: trackers.length, alerted, rate_limited: skipped }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[price-scanner] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
