/**
 * src/routes/api/telegram/webhook.ts
 *
 * TanStack Start API route — receives incoming Telegram webhook updates
 * and dispatches them to the grammY bot instance.
 *
 * Security: validates `x-telegram-bot-api-secret-token` header.
 * Set the same secret when registering the webhook:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>&secret_token=<SECRET>
 */

import { createAPIFileRoute } from "@tanstack/react-start/api";
import { webhookCallback } from "grammy";
import { bot } from "~/lib/telegram.server";

const handleUpdate = webhookCallback(bot, "std/http");

export const APIRoute = createAPIFileRoute("/api/telegram/webhook")({
  POST: async ({ request }) => {
    // ── Secret token validation ─────────────────────────────────────────────
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    const expectedSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];

    if (!expectedSecret) {
      console.warn(
        "[FlightIQ Telegram] TELEGRAM_WEBHOOK_SECRET is not set — webhook is unprotected!",
      );
    } else if (secret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    // ── Dispatch to grammY ──────────────────────────────────────────────────
    try {
      return await handleUpdate(request);
    } catch (err) {
      console.error("[FlightIQ Telegram] Webhook handler error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  // Telegram sends a HEAD request when verifying the webhook URL
  GET: async () => {
    return new Response("FlightIQ Telegram Webhook is active.", { status: 200 });
  },
});
