import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bell,
  Mail,
  Send,
  ExternalLink,
  Plane,
  Loader2,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, getCurrency } from "@/lib/currency";
import { findAirport } from "@/lib/airports";
import { trackPriceAlertCreated } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TELEGRAM_BOT_USERNAME = "FlightIQBot";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  currency: string;
  currentPriceUsd: number;
};

type Channel = "email" | "telegram";

export function AlertModal({
  open,
  onOpenChange,
  origin,
  destination,
  departureDate,
  returnDate,
  currency,
  currentPriceUsd,
}: Props) {
  const currencyRate = getCurrency(currency).rate;
  const currentPriceInCurrency = Math.round(currentPriceUsd * currencyRate);

  const [targetPrice, setTargetPrice] = useState<string>("");
  const [alertOnAnyDrop, setAlertOnAnyDrop] = useState<boolean>(false);
  const [channel, setChannel] = useState<Channel>("email");
  const [email, setEmail] = useState<string>("");
  const [telegramChatId, setTelegramChatId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  const originAirport = findAirport(origin);
  const destAirport = findAirport(destination);

  // Pre-fill email and capture user ID from active Supabase session
  useEffect(() => {
    if (open) {
      setSuccess(false);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.email) {
          setEmail(session.user.email);
        }
        if (session?.user?.id) {
          setUserId(session.user.id);
        }
      });
      // Suggest a 10% lower target price
      const suggested = Math.round(currentPriceInCurrency * 0.9);
      setTargetPrice(String(suggested));
    }
  }, [open, currentPriceInCurrency]);

  async function handleStartTracking(e: React.FormEvent) {
    e.preventDefault();

    if (channel === "email") {
      if (!email || !email.includes("@")) {
        toast.error("Please enter a valid email address.");
        return;
      }
    } else if (channel === "telegram") {
      if (!telegramChatId.trim()) {
        toast.error("Please provide your Telegram Chat ID.");
        return;
      }
    }

    let finalTargetPrice = currentPriceInCurrency;
    if (!alertOnAnyDrop) {
      const num = Number(targetPrice);
      if (!num || num <= 0) {
        toast.error("Please enter a valid target price or choose 'Alert me on any price drop'.");
        return;
      }
      finalTargetPrice = num;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("price_trackers").insert({
        origin_iata: origin.toUpperCase(),
        destination_iata: destination.toUpperCase(),
        departure_date: departureDate,
        return_date: returnDate || null,
        target_price: alertOnAnyDrop ? null : finalTargetPrice,
        currency: currency,
        email: channel === "email" ? email.trim() : null,
        telegram_chat_id: channel === "telegram" ? telegramChatId.trim() : null,
        is_active: true,
      });

      if (error) {
        console.error("Error creating price tracker:", error);
        toast.error("Could not activate price alert. Please try again.");
        return;
      }

      // If logged-in user chose Telegram, link their profile to this chat ID
      // so trackers show up on the deals page
      if (channel === "telegram" && userId && telegramChatId.trim()) {
        await supabase
          .from("profiles")
          .update({ telegram_chat_id: telegramChatId.trim() })
          .eq("id", userId);
      }

      // Track analytics conversion event
      trackPriceAlertCreated({
        route: `${origin} → ${destination}`,
        target_price: Math.round(finalTargetPrice / currencyRate),
        channel,
      });

      setSuccess(true);
      toast.success("Fare tracker activated! We'll alert you the moment prices drop.");
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while setting up your alert.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Set Price Alert</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Never overpay. Get instant alerts when fares on this route drop.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Fare Tracker Active!</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Monitoring {origin} → {destination} for price drops below{" "}
                <span className="font-semibold text-foreground">
                  {alertOnAnyDrop
                    ? formatPrice(currentPriceInCurrency / currencyRate, currency)
                    : formatPrice(Number(targetPrice) / currencyRate, currency)}
                </span>
                .
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                Alerts will be sent via {channel === "email" ? `Email (${email})` : "Telegram Bot"}.
              </p>
            </div>

            {/* Connect Telegram CTA — shown after saving a Telegram tracker */}
            {channel === "telegram" && (
              <a
                href={
                  userId
                    ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${userId}`
                    : `https://t.me/${TELEGRAM_BOT_USERNAME}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
              >
                <Send className="h-4 w-4" />
                Connect @{TELEGRAM_BOT_USERNAME} on Telegram
                <ExternalLink className="h-3.5 w-3.5 opacity-75" />
              </a>
            )}

            <Button onClick={() => onOpenChange(false)} className="w-full glow-cta mt-2">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleStartTracking} className="space-y-4 pt-1">
            {/* Active Route Details Card */}
            <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 text-xs shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="h-3.5 w-3.5 text-primary" />
                  <span className="font-bold text-foreground">
                    {originAirport ? originAirport.city : origin} ({origin}) →{" "}
                    {destAirport ? destAirport.city : destination} ({destination})
                  </span>
                </div>
                <span className="font-mono font-bold text-primary">
                  {formatPrice(currentPriceUsd, currency)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Departs {departureDate}</span>
                {returnDate && <span>• Returns {returnDate}</span>}
              </div>
            </div>

            {/* Target Price or Any Drop Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="target-price" className="text-xs font-semibold">
                  Target Price ({currency})
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Current: {formatPrice(currentPriceUsd, currency)}
                </span>
              </div>

              <div className="relative">
                <Input
                  id="target-price"
                  type="number"
                  placeholder={String(currentPriceInCurrency)}
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  disabled={alertOnAnyDrop}
                  className={cn(
                    "font-mono font-medium text-sm transition-opacity",
                    alertOnAnyDrop && "opacity-50 cursor-not-allowed",
                  )}
                />
              </div>

              {/* Checkbox: Alert me on any price drop */}
              <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-foreground select-none">
                <Checkbox
                  checked={alertOnAnyDrop}
                  onCheckedChange={(checked) => setAlertOnAnyDrop(Boolean(checked))}
                />
                <span className="font-medium">Alert me on any price drop</span>
              </label>
            </div>

            {/* Channel Selection Pills */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Notification Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                {/* Email Alert Pill */}
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all",
                    channel === "email"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card/40 hover:bg-accent",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Mail
                      className={cn(
                        "h-3.5 w-3.5",
                        channel === "email" ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        channel === "email" ? "text-primary" : "text-foreground",
                      )}
                    >
                      Email Alert
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">via ZeptoMail</span>
                </button>

                {/* Telegram Bot Alert Pill */}
                <button
                  type="button"
                  onClick={() => setChannel("telegram")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-all",
                    channel === "telegram"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border bg-card/40 hover:bg-accent",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <Send
                      className={cn(
                        "h-3.5 w-3.5",
                        channel === "telegram" ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        channel === "telegram" ? "text-primary" : "text-foreground",
                      )}
                    >
                      Telegram Alert
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Instant Bot Push</span>
                </button>
              </div>
            </div>

            {/* Channel Specific Input */}
            {channel === "email" ? (
              <div className="space-y-1.5">
                <Label htmlFor="alert-email" className="text-xs font-medium">
                  Your Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="alert-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs"
                    required
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  We'll send a notification the moment an airline drops the price.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="telegram-chat-id" className="text-xs font-medium">
                    Telegram Chat ID
                  </Label>
                  <a
                    href="https://t.me/FlightIQBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    <span>Open @FlightIQBot</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <Input
                  id="telegram-chat-id"
                  type="text"
                  placeholder="e.g. 123456789 or @username"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Click the link above to start a chat with <strong>@FlightIQBot</strong> on
                  Telegram to receive alerts.
                </p>
              </div>
            )}

            {/* CTA Button: Start Tracking Fares */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full glow-cta gap-2 rounded-xl py-2.5 font-bold shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating Tracker...
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  <span>Start Tracking Fares</span>
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
