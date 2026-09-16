import { useState } from "react";
import { TrendingDown, Sparkles, ExternalLink, Bell, Clock, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, getCurrency } from "@/lib/currency";
import { formatDuration, type FlightOffer, type SearchParams } from "@/lib/flights";
import { buildSkyscannerDeepLink } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/analytics";
import { BookingProviderModal } from "@/components/BookingProviderModal";
import { cn } from "@/lib/utils";

type Props = {
  offer: FlightOffer;
  searchParams: SearchParams;
  currency: string;
  onTrackPrice: (offer: FlightOffer) => void;
  onBookDeal?: (offer: FlightOffer) => void;
};

// Airline brand styling helper
const AIRLINE_THEMES: Record<string, { bg: string; text: string; border: string; accent: string }> =
  {
    KQ: {
      bg: "bg-red-950/40",
      text: "text-red-400",
      border: "border-red-800/40",
      accent: "bg-red-500",
    },
    EK: {
      bg: "bg-amber-950/40",
      text: "text-amber-300",
      border: "border-amber-700/40",
      accent: "bg-amber-400",
    },
    QR: {
      bg: "bg-purple-950/40",
      text: "text-purple-300",
      border: "border-purple-800/40",
      accent: "bg-purple-400",
    },
    TK: {
      bg: "bg-rose-950/40",
      text: "text-rose-400",
      border: "border-rose-800/40",
      accent: "bg-rose-500",
    },
    ET: {
      bg: "bg-emerald-950/40",
      text: "text-emerald-300",
      border: "border-emerald-800/40",
      accent: "bg-emerald-400",
    },
    BA: {
      bg: "bg-blue-950/40",
      text: "text-blue-300",
      border: "border-blue-800/40",
      accent: "bg-blue-500",
    },
    KL: {
      bg: "bg-cyan-950/40",
      text: "text-cyan-300",
      border: "border-cyan-800/40",
      accent: "bg-cyan-400",
    },
    LH: {
      bg: "bg-indigo-950/40",
      text: "text-yellow-400",
      border: "border-yellow-700/40",
      accent: "bg-yellow-400",
    },
    AF: {
      bg: "bg-sky-950/40",
      text: "text-sky-300",
      border: "border-sky-800/40",
      accent: "bg-red-500",
    },
    QF: {
      bg: "bg-orange-950/40",
      text: "text-orange-300",
      border: "border-orange-800/40",
      accent: "bg-orange-500",
    },
  };

function AirlineLogo({
  code,
  name,
  logo,
}: {
  code: string;
  name: string;
  logo?: string | null | undefined;
}) {
  const theme = AIRLINE_THEMES[code] ?? {
    bg: "bg-primary/15",
    text: "text-primary",
    border: "border-primary/20",
    accent: "bg-primary",
  };

  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-1 shadow-sm transition-transform group-hover:scale-105",
        theme.bg,
        theme.border,
      )}
      title={name}
    >
      {logo && !imgError ? (
        <img
          src={logo}
          alt={name}
          className="h-8 w-8 object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      ) : (
        <div className="text-center">
          <span className={cn("block text-xs font-black tracking-wider leading-none", theme.text)}>
            {code}
          </span>
          <span className="block text-[8px] font-medium tracking-tight text-muted-foreground line-clamp-1 max-w-[36px]">
            {name.split(" ")[0]}
          </span>
        </div>
      )}
      <div className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full", theme.accent)} />
    </div>
  );
}

export function FlightCard({
  offer,
  searchParams,
  currency,
  onTrackPrice,
  onBookDeal,
}: Props) {
  const [bookingModalOpen, setBookingModalOpen] = useState(false);

  function handleSelectDeal() {
    if (onBookDeal) {
      onBookDeal(offer);
    }
    setBookingModalOpen(true);
  }

  const isDirect = offer.stops === 0;
  const stopoverText = isDirect
    ? "Direct / Nonstop"
    : offer.stops === 1
      ? "1 Stopover"
      : `${offer.stops} Stopovers`;

  const isConvertedFromUsd = currency !== "USD";

  return (
    <div className="glass-panel group relative overflow-hidden rounded-2xl border border-border/70 p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-xl sm:p-6">
      {/* Top row: Airline info + Status Badges */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AirlineLogo
            code={offer.airlineCode}
            name={offer.airline}
            logo={offer.airlineLogo}
          />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold tracking-tight text-foreground sm:text-base">
              {offer.airline}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className={cn("font-medium", isDirect ? "text-success" : "text-muted-foreground")}>
                {stopoverText}
              </span>
              <span>•</span>
              <span className="capitalize">{searchParams.cabin}</span>
            </p>
          </div>
        </div>

        {/* Highlight Badges */}
        <div className="flex shrink-0 items-center gap-2">
          {offer.dropPercent > 0 && (
            <Badge className="gap-1 bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success border-success/30 hover:bg-success/20">
              <TrendingDown className="h-3 w-3" />
              -{offer.dropPercent}%
            </Badge>
          )}
          {offer.bestLocalFare && (
            <Badge className="gap-1 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
              <Sparkles className="h-3 w-3" />
              Best Fare
            </Badge>
          )}
        </div>
      </div>

      {/* Middle row: Schedule and Timeline Visualizer */}
      <div className="mt-6 grid grid-cols-1 items-center gap-4 rounded-xl bg-card/40 p-4 sm:grid-cols-[auto_1fr_auto]">
        {/* Departure */}
        <div className="text-left">
          <p className="text-2xl font-extrabold tracking-tight text-foreground font-mono">
            {offer.departTime}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {offer.origin}
            </span>
            <span className="text-xs text-muted-foreground font-medium">Departure</span>
          </div>
        </div>

        {/* Timeline Visualizer */}
        <div className="flex flex-col items-center px-2">
          <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDuration(offer.durationMinutes)}</span>
          </div>

          <div className="relative flex w-full items-center justify-between">
            {/* Origin Node */}
            <div className="z-10 h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm" />

            {/* Path line */}
            <div className="relative mx-1 h-0.5 flex-1 bg-border group-hover:bg-primary/40 transition-colors">
              {/* Mid-flight plane icon */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card p-1 text-primary shadow-xs">
                <Plane className="h-3.5 w-3.5 rotate-90" />
              </div>
            </div>

            {/* Destination Node */}
            <div className="z-10 h-3 w-3 rounded-full border-2 border-accent bg-accent shadow-sm" />
          </div>

          {/* Stopover badge in timeline */}
          <div className="mt-1.5">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                isDirect
                  ? "bg-success/10 text-success"
                  : "bg-amber-500/10 text-amber-400 font-medium",
              )}
            >
              {stopoverText}
            </span>
          </div>
        </div>

        {/* Arrival */}
        <div className="text-left sm:text-right">
          <p className="text-2xl font-extrabold tracking-tight text-foreground font-mono">
            {offer.arriveTime}
          </p>
          <div className="mt-1 flex items-center justify-start sm:justify-end gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Arrival</span>
            <span className="inline-flex rounded-md bg-accent/15 px-2 py-0.5 font-mono text-xs font-bold text-accent">
              {offer.destination}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom row: Price Display & Dual CTAs */}
      <div className="mt-5 flex flex-col gap-4 border-t border-border/80 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {offer.dropPercent > 0 && (
            <p className="text-xs text-muted-foreground line-through font-mono">
              {formatPrice(offer.baselineUsd, currency)}
            </p>
          )}

          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight text-foreground">
              {formatPrice(offer.priceUsd, currency)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">/ pax</span>
          </div>

          {isConvertedFromUsd && (
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
              ~ ${offer.priceUsd.toLocaleString()} USD · No markup
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTrackPrice(offer)}
            className="gap-1.5 rounded-xl border-border/80 bg-background/60 hover:bg-accent/60 font-medium"
          >
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs">Set Alert</span>
          </Button>

          <Button
            type="button"
            onClick={handleSelectDeal}
            size="sm"
            className="glow-cta gap-1.5 rounded-xl font-semibold shadow-md"
          >
            <span className="text-xs">Book Deal</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <BookingProviderModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        offer={offer}
        searchParams={searchParams}
        currency={currency}
      />
    </div>
  );
}
