/**
 * scripts/test-telegram.mjs
 *
 * Diagnostic: dispatch a mock price-drop alert to a Telegram chat.
 *
 * Usage:
 *   node scripts/test-telegram.mjs
 *
 * Required env vars (loaded from .env):
 *   TELEGRAM_BOT_TOKEN  – the bot token
 *
 * Override the destination chat by setting TEST_CHAT_ID:
 *   TEST_CHAT_ID=123456789 node scripts/test-telegram.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
  console.warn("[test-telegram] Could not load .env — relying on shell env.");
}

// ── Config ────────────────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TEST_CHAT_ID = process.env.TEST_CHAT_ID ?? "";

if (!BOT_TOKEN) {
  console.error(
    "❌ FATAL: TELEGRAM_BOT_TOKEN is not set. Add it to .env and retry."
  );
  process.exit(1);
}

if (!TEST_CHAT_ID) {
  console.warn(
    "⚠️  TEST_CHAT_ID is not set. Using getUpdates to find a valid chat ID..."
  );

  // Try to auto-detect a chat ID from recent bot updates
  const updRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5`,
    { method: "GET" }
  );
  const updData = await updRes.json();

  if (!updRes.ok || !updData.ok) {
    console.error("❌ getUpdates failed:", JSON.stringify(updData));
    process.exit(1);
  }

  const firstUpdate = updData.result?.[0];
  if (!firstUpdate) {
    console.error(
      "❌ No updates found. Send any message to your bot first, then retry.\n" +
      "   Or set TEST_CHAT_ID=<your_chat_id> and re-run."
    );
    process.exit(1);
  }

  const chatId =
    firstUpdate.message?.chat?.id ??
    firstUpdate.callback_query?.message?.chat?.id;

  if (!chatId) {
    console.error("❌ Could not extract chat_id from updates:", JSON.stringify(firstUpdate));
    process.exit(1);
  }

  console.log(`[test-telegram] Auto-detected chat_id: ${chatId}`);
  process.env.TEST_CHAT_ID = String(chatId);
}

const CHAT_ID = process.env.TEST_CHAT_ID;

// ── Mock payload ──────────────────────────────────────────────────────────────
const payload = {
  originIata: "NBO",
  destinationIata: "CPT",
  currency: "USD",
  newPrice: 42000,
  targetPrice: 50000,
  departureDate: "2026-10-15",
  skyscannerLink:
    "https://www.skyscanner.net/transport/flights/nbo/cpt/261015/?adultsv2=1&cabinclass=economy",
};

// ── Format message ─────────────────────────────────────────────────────────────
const text =
  `🧪 *[DIAGNOSTIC TEST]*\n\n` +
  `🚨 *PRICE DROP ALERT!*\n\n` +
  `✈️ *${payload.originIata}* ➔ *${payload.destinationIata}*\n` +
  `💰 New Low Fare: *${payload.currency} ${payload.newPrice.toLocaleString()}*\n` +
  `🎯 Your Target: *${payload.currency} ${payload.targetPrice.toLocaleString()}*\n` +
  `📅 Departure: ${payload.departureDate}`;

const keyboard = {
  inline_keyboard: [
    [{ text: "🔗 Book on Skyscanner", url: payload.skyscannerLink }],
  ],
};

// ── Send ───────────────────────────────────────────────────────────────────────
console.log(`[test-telegram] Sending alert to chat_id: ${CHAT_ID}`);

const res = await fetch(
  `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }),
  }
);

const responseData = await res.json();

if (res.ok && responseData.ok) {
  console.log("✅ Telegram: message sent successfully!");
  console.log("   Message ID:", responseData.result?.message_id);
  console.log("   Chat:", responseData.result?.chat?.username ?? CHAT_ID);
} else {
  console.error("❌ Telegram sendMessage FAILED");
  console.error("   HTTP Status:", res.status);
  console.error("   Telegram error:", responseData.description ?? JSON.stringify(responseData));
  process.exit(1);
}

// ── Bonus: verify bot info ─────────────────────────────────────────────────────
const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
const meData = await meRes.json();
if (meData.ok) {
  console.log(`\n✅ Bot identity: @${meData.result.username} (id: ${meData.result.id})`);
}
