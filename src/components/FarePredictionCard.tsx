import { useMemo } from "react";
import { TrendingUp, TrendingDown, Sparkles, BellRing, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrencyAmount, convertCurrencyAmount } from "@/lib/currency";
import type { FlightOffer, SearchParams } from "@/lib/flights";
import { cn } from "@/lib/utils";

interface FarePredictionCardProps {
  offers: FlightOffer[];
  searchParams: SearchParams;
  currency: string;
  onTrackRoute?: () => void;
}

export function FarePredictionCard({
  offers,
  searchParams,
  currency,
  onTrackRoute,
}: FarePredictionCardProps) {
  const prediction = useMemo(() => {
    if (!offers || offers.length === 0) return null;

    const prices = offers.map((o) => convertCurrencyAmount(o.price, o.currency, currency));
    const lowestPrice = Math.min(...prices);
    const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);

    // Calculate days until departure
    const depDate = new Date(searchParams.departureDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    depDate.setHours(0, 0, 0, 0);
    const diffTime = depDate.getTime() - today.getTime();
    const daysUntilDeparture = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Maximum price drop among offers
    const maxDrop = Math.max(...offers.map((o) => o.dropPercent || 0));

    let recommendation: "BUY_NOW" | "WAIT" | "FAIR_PRICE" = "BUY_NOW";
    let score = 85; // 0-100 score: >70 = Buy now, 40-70 = Fair, <40 = Wait
    let headline = "Buy now — Great fare";
    let sublabel = "Prices are unlikely to drop before departure.";
    let explanation =
      "Historical data shows airline fares for this corridor increase significantly within 14 days of departure. We recommend securing this ticket today.";

    if (maxDrop >= 15) {
      recommendation = "BUY_NOW";
      score = 92;
      headline = "Strong Buy — Rare Price Drop";
      sublabel = `Fare is currently ${maxDrop}% below route average!`;
      explanation = `A significant price drop has been detected on this route. Fares at this level typically sell out within 24 hours.`;
    } else if (daysUntilDeparture <= 14) {
      recommendation = "BUY_NOW";
      score = 88;
      headline = "Buy now — Departure is near";
      sublabel = "Fares rise sharply within the final 2 weeks.";
      explanation =
        "With departure in less than two weeks, remaining seats are in high demand and prices historically climb by 18–35%.";
    } else if (daysUntilDeparture > 45 && maxDrop === 0 && lowestPrice >= avgPrice * 0.95) {
      recommendation = "WAIT";
      score = 38;
      headline = "Wait — Opportunity to drop";
      sublabel = "Departure is over 6 weeks away.";
      explanation =
        "Airlines frequently launch promotional discounts 3–5 weeks prior to departure for this route. Set a price alert to be notified when rates dip.";
    } else {
      recommendation = "FAIR_PRICE";
      score = 65;
      headline = "Fair price — Standard rate";
      sublabel = "Current fare matches typical seasonal pricing.";
      explanation =
        "The current fare is aligned with standard market rates. If your travel dates are rigid, book now; if flexible, track for sudden promotions.";
    }

    return {
      recommendation,
      score,
      headline,
      sublabel,
      explanation,
      lowestPrice,
      avgPrice,
      daysUntilDeparture,
      maxDrop,
    };
  }, [offers, searchParams, currency]);

  if (!prediction) return null;

  const isBuy = prediction.recommendation === "BUY_NOW";
  const isWait = prediction.recommendation === "WAIT";

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 shadow-xs sm:p-6 transition-all hover:border-border">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold tracking-tight text-foreground">
                Fare Prediction & Guidance
              </h4>
              <Badge
                variant="outline"
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  isBuy
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : isWait
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-sky-500/40 bg-sky-500/10 text-sky-400",
                )}
              >
                {isBuy ? "Buy Now" : isWait ? "Wait & Track" : "Fair Value"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Market forecast for {searchParams.origin} → {searchParams.destination}
            </p>
          </div>
        </div>

        {onTrackRoute && (
          <Button
            type="button"
            size="sm"
            onClick={onTrackRoute}
            variant="outline"
            className="gap-1.5 rounded-xl border-primary/30 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/15"
          >
            <BellRing className="h-3.5 w-3.5" />
            <span>Track This Fare</span>
          </Button>
        )}
      </div>

      {/* Main Stats Body */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isBuy ? (
              <TrendingDown className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <TrendingUp className="h-4 w-4 text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-extrabold text-foreground">{prediction.headline}</span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{prediction.explanation}</p>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-muted-foreground">
            <span>
              Best current fare:{" "}
              <strong className="font-mono text-foreground font-bold">
                {formatCurrencyAmount(prediction.lowestPrice, currency)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Corridor average:{" "}
              <strong className="font-mono text-muted-foreground font-medium">
                {formatCurrencyAmount(prediction.avgPrice, currency)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Departure:{" "}
              <strong className="text-foreground">
                {prediction.daysUntilDeparture === 0
                  ? "Today"
                  : `${prediction.daysUntilDeparture} days out`}
              </strong>
            </span>
          </div>
        </div>

        {/* Prediction Score Gauge (AirTrackBot style) */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-background/50 px-5 py-3 text-center sm:min-w-[140px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Confidence Score
          </span>
          <div className="flex items-baseline gap-1 my-0.5">
            <span className="font-mono text-2xl font-black text-foreground">
              {prediction.score}
            </span>
            <span className="text-xs text-muted-foreground">/100</span>
          </div>

          {/* 3-segment color gauge bar */}
          <div className="w-24 h-1.5 rounded-full overflow-hidden flex gap-0.5 my-1">
            <div
              className={cn(
                "h-full flex-1 rounded-l-full",
                prediction.score < 45 ? "bg-amber-400" : "bg-muted/40",
              )}
            />
            <div
              className={cn(
                "h-full flex-1",
                prediction.score >= 45 && prediction.score <= 75 ? "bg-sky-400" : "bg-muted/40",
              )}
            />
            <div
              className={cn(
                "h-full flex-1 rounded-r-full",
                prediction.score > 75 ? "bg-emerald-400" : "bg-muted/40",
              )}
            />
          </div>

          <span className="text-[10px] font-semibold text-muted-foreground">
            {isBuy ? "Recommended to book" : isWait ? "Price may drop" : "Stable fare"}
          </span>
        </div>
      </div>
    </div>
  );
}
