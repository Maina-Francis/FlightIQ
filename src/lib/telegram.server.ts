/**
 * telegram.server.ts
 * Server-only grammY bot instance for @FlightIQBot.
 * NEVER import this from client-side code — it is .server.ts for a reason.
 *
 * Commands:
 *  /start [userId]  — Welcome message; links telegram_chat_id to a profiles row
 *                     when a deep-link payload (user_id) is provided.
 *  /track <O> <D> <price> — Creates a price_trackers row via the chat ID.
 *  /deals           — Lists the user's active price trackers.
 */

import { Bot, InlineKeyboard } from "grammy";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Bot Initialisation ───────────────────────────────────────────────────────

const token = process.env["TELEGRAM_BOT_TOKEN"];
if (!token) {
  // Warn at boot time; the bot simply won't function without a token.
  console.warn(
    "[FlightIQ Telegram] TELEGRAM_BOT_TOKEN is not set. Bot will not handle updates.",
  );
}

export const bot = new Bot(token ?? "MISSING_TOKEN");

// ─── /start — Welcome & Account Linking ──────────────────────────────────────

bot.command("start", async (ctx) => {
  const payload = ctx.match; // deep-link parameter, e.g. the Supabase user UUID
  const chatId = ctx.chat.id.toString();

  if (payload) {
    // Link this Telegram chat to the authenticated Supabase user's profile
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: payload, telegram_chat_id: chatId },
        { onConflict: "id" },
      );

    if (error) {
      console.error("[FlightIQ Telegram] Failed to link account:", error.message);
      await ctx.reply(
        "⚠️ Hmm, something went wrong linking your account. Please try again from the FlightIQ website.",
      );
      return;
    }

    await ctx.reply(
      "✅ *Account Linked!*\n\nYou will now receive instant flight price drop alerts right here.\n\nType /help to see available commands.",
      { parse_mode: "Markdown" },
    );
    return;
  }

  await ctx.reply(
    "✈️ *Welcome to FlightIQ Bot!*\n\n" +
    "Track flight prices in real-time and get alerted the moment fares drop.\n\n" +
    "*Commands:*\n" +
    "• `/track NBO CPT 80000` — Track a route with a target price\n" +
    "• `/track NBO CPT any` — Alert on any price drop\n" +
    "• `/deals` — View your active price trackers\n" +
    "• `/help` — Show all commands\n\n" +
    "_Visit [FlightIQ](https://flightIQ.app) to set up alerts from your browser._",
    { parse_mode: "Markdown" },
  );
});

// ─── /track — Create a Price Tracker ─────────────────────────────────────────

bot.command("track", async (ctx) => {
  const args = ctx.match.trim().split(/\s+/);

  if (args.length < 2 || args[0] === "") {
    return ctx.reply(
      "⚠️ *Usage:* `/track <ORIGIN> <DESTINATION> [TARGET_PRICE]`\n\n" +
      "_Examples:_\n" +
      "• `/track NBO CPT 85000` — alert when fare drops below 85,000\n" +
      "• `/track NBO CPT any` — alert on any price drop\n\n" +
      "• Origin & destination are IATA airport codes (3 letters)\n" +
      "• Target price is in your local currency",
      { parse_mode: "Markdown" },
    );
  }

  const [origin, destination, rawPrice] = args;
  const chatId = ctx.chat.id.toString();

  const isAnyDrop = rawPrice?.toLowerCase() === "any";
  const targetPrice = isAnyDrop ? null : parseFloat(rawPrice ?? "0");

  if (!origin || !destination || (!isAnyDrop && (isNaN(targetPrice!) || targetPrice! <= 0))) {
    return ctx.reply(
      "❌ Invalid arguments. Please provide valid IATA codes and a positive target price (or 'any').\n\n" +
      "_Example:_ `/track NBO CPT 85000` or `/track NBO CPT any`",
      { parse_mode: "Markdown" },
    );
  }

  const today = new Date().toISOString().split("T")[0] ?? new Date().toISOString().substring(0, 10);

  const { error } = await supabaseAdmin.from("price_trackers").insert({
    telegram_chat_id: chatId,
    origin_iata: origin.toUpperCase(),
    destination_iata: destination.toUpperCase(),
    departure_date: today,
    target_price: targetPrice,
    currency: "USD",
    is_active: true,
  });

  if (error) {
    console.error("[FlightIQ Telegram] /track insert failed:", error.message);
    return ctx.reply("❌ Failed to set up price alert. Please try again.");
  }

  const keyboard = new InlineKeyboard().url(
    "🔍 Search on Skyscanner",
    `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/`,
  );

  const priceLabel = isAnyDrop
    ? "any price drop"
    : `${targetPrice!.toLocaleString()}`;

  return await ctx.reply(
    `🎉 *Tracker Set!*\n\n` +
    `Monitoring ✈️ *${origin.toUpperCase()}* ➔ *${destination.toUpperCase()}*\n` +
    `We'll notify you on ${isAnyDrop ? "*any price drop*" : `when fares drop below *${priceLabel}*`}.\n\n` +
    `_Type /deals to see all your active trackers._`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// ─── /deals — List Active Trackers ───────────────────────────────────────────

bot.command("deals", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  const { data: trackers, error } = await supabaseAdmin
    .from("price_trackers")
    .select("origin_iata, destination_iata, target_price, currency, departure_date")
    .eq("telegram_chat_id", chatId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[FlightIQ Telegram] /deals query failed:", error.message);
    return ctx.reply("❌ Could not fetch your trackers right now. Please try again.");
  }

  if (!trackers || trackers.length === 0) {
    return ctx.reply(
      "📭 *No active trackers.*\n\nUse `/track NBO CPT 80000` to set up your first price alert!",
      { parse_mode: "Markdown" },
    );
  }

  const lines = trackers.map((t, i) => {
    const price = t.target_price
      ? `${t.currency ?? "USD"} ${t.target_price.toLocaleString()}`
      : "any drop";
    return `${i + 1}. ✈️ *${t.origin_iata}* ➔ *${t.destination_iata}* — below ${price}`;
  });

  return await ctx.reply(
    `📋 *Your Active Trackers:*\n\n${lines.join("\n")}\n\n` +
    `_Visit [FlightIQ](https://flightIQ.app) to manage your alerts._`,
    { parse_mode: "Markdown" },
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  await ctx.reply(
    "*FlightIQ Bot Commands:*\n\n" +
    "• `/start` — Welcome & account setup\n" +
    "• `/track <ORIGIN> <DEST> <PRICE>` — Set a price alert\n" +
    "• `/track <ORIGIN> <DEST> any` — Alert on any price drop\n" +
    "• `/deals` — View your active trackers\n" +
    "• `/help` — Show this message\n\n" +
    "_Examples:_ `/track NBO LHR 120000` or `/track NBO LHR any`",
    { parse_mode: "Markdown" },
  );
});

// ─── Price Drop Alert Formatter (used by price-scanner) ──────────────────────

export type PriceDropPayload = {
  chatId: string;
  originIata: string;
  destinationIata: string;
  currency: string;
  newPrice: number;
  targetPrice: number;
  departureDate: string;
  skyscannerLink: string;
};

/**
 * Sends a price drop alert message via the Telegram Bot API.
 * Called from the price-scanner edge function (or server workers).
 * Falls back to a raw fetch so it can be re-used in Deno environments.
 */
export async function sendPriceDropAlert(payload: PriceDropPayload): Promise<void> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (!botToken) {
    console.warn("[FlightIQ Telegram] Skipping alert — TELEGRAM_BOT_TOKEN not set.");
    return;
  }

  const text =
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

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[FlightIQ Telegram] sendMessage failed (${res.status}): ${body}`);
  }
}
