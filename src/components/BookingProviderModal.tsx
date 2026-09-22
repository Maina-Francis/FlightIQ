import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Clock, Plane, ShieldCheck, Check, Sparkles, Calendar, Moon, ArrowRight } from "lucide-react";
import { convertCurrencyAmount, formatCurrencyAmount } from "@/lib/currency";
import {
  formatFlightDuration,
  getFlightLayovers,
  getArrivalDayOffset,
  type FlightOffer,
  type SearchParams,
  type FlightSegment,
} from "@/lib/flights";
import { buildSkyscannerDeepLink } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface BookingProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: FlightOffer;
  searchParams: SearchParams;
  currency: string;
}

const AVIASALES_MARKER = "778298";

function buildAviasalesFallbackUrl(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  adults: number;
}) {
  const formatDDMM = (date: string) => {
    const [, month, day] = date.split("-");
    return `${day ?? ""}${month ?? ""}`;
  };
  const dep = formatDDMM(params.departureDate);
  const ret = params.returnDate ? formatDDMM(params.returnDate) : "";
  const route = `${params.origin.toUpperCase()}${dep}${params.destination.toUpperCase()}${ret}${params.adults}`;
  return `https://www.aviasales.com/search/${route}?marker=${AVIASALES_MARKER}`;
}

export function BookingProviderModal({
  open,
  onOpenChange,
  offer,
  searchParams,
  currency,
}: BookingProviderModalProps) {
  const [logoError, setLogoError] = useState(false);

  // Ensure the offer's segment count minus 1 is passed as stops
  // and the first segment's departing_at time is passed as departureTime
  const rawSegments = offer.rawOffer?.slices?.[0]?.segments;
  const stops =
    rawSegments && Array.isArray(rawSegments)
      ? Math.max(0, rawSegments.length - 1)
      : (offer.stops ?? 0);

  const departureTime = rawSegments?.[0]?.departing_at ?? offer.departingAt ?? offer.departTime;

  const isDirect = stops === 0;
  const stopoverText = isDirect
    ? "Direct / Nonstop"
    : stops === 1
      ? "1 Stopover"
      : `${stops} Stopovers`;

  const aviasalesUrl =
    offer.deepLink ||
    offer.bookingOptions?.find((opt) => opt.isRecommended)?.deepLink ||
    offer.bookingOptions?.[0]?.deepLink ||
    buildAviasalesFallbackUrl({
      origin: offer.origin,
      destination: offer.destination,
      departureDate: searchParams.departureDate,
      returnDate: searchParams.returnDate,
      adults: searchParams.adults,
    });

  // Build the enhanced Skyscanner deep link with exact stops and outboundtime window
  const skyscannerUrl = buildSkyscannerDeepLink({
    origin: offer.origin,
    destination: offer.destination,
    departureDate: searchParams.departureDate,
    returnDate: searchParams.returnDate,
    adults: searchParams.adults,
    cabinClass: searchParams.cabin,
    currency,
    carrierCode: offer.airlineCode !== "??" ? offer.airlineCode : undefined,
    stops,
    departureTime,
  });

  const displayPrice = convertCurrencyAmount(offer.price, offer.currency, currency);

  function handleBookAviasales() {
    trackAffiliateClick({
      airline: offer.airline,
      price: displayPrice,
      currency,
      skyscanner_deep_link: aviasalesUrl,
    });
    window.open(aviasalesUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  function handleBookSkyscanner() {
    trackAffiliateClick({
      airline: offer.airline,
      price: displayPrice,
      currency,
      skyscanner_deep_link: skyscannerUrl,
    });
    window.open(skyscannerUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Header Banner */}
        <div className="border-b border-border/70 bg-linear-to-br from-card/80 via-card/50 to-primary/5 p-6 sm:p-7">
          <DialogHeader className="text-left space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {offer.airlineLogo && !logoError ? (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-card p-1 shadow-xs">
                    <img
                      src={offer.airlineLogo}
                      alt={offer.airline}
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoError(true)}
                    />
                  </div>
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-xs font-black text-primary shadow-xs">
                    {offer.airlineCode}
                  </div>
                )}
                <div>
                  <DialogTitle className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                    {offer.airline}
                  </DialogTitle>
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono font-bold text-foreground">
                      {offer.origin} → {offer.destination}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{searchParams.cabin}</span>
                  </p>
                </div>
              </div>

              {/* FlightIQ Fare Highlight */}
              <div className="text-right">
                <span className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  {formatCurrencyAmount(displayPrice, currency)}
                </span>
                <span className="block text-[11px] font-medium text-muted-foreground">/ pax</span>
              </div>
            </div>

            {/* Flight Metrics Strip */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 px-2.5 py-0.5 font-semibold text-[11px]",
                  isDirect
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400",
                )}
              >
                {stopoverText}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-border/80 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                <Clock className="h-3 w-3 text-primary" />
                {formatFlightDuration(offer.durationMinutes)}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-border/80 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                <Plane className="h-3 w-3 text-primary" />
                Departs {offer.departTime}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-border/80 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                <Calendar className="h-3 w-3 text-primary" />
                {searchParams.departureDate}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-6 sm:p-7">
          {/* Brief Disclosure */}
          <div className="flex items-start gap-2.5 rounded-xl border border-border/80 bg-card/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Continue through a verified partner link. Aviasales opens live metasearch results
              where you can compare Trip.com, Kiwi, eDreams, and official airline fares.
            </DialogDescription>
          </div>

          {/* Itinerary Breakdown — only shown when per-segment data is available */}
          {(() => {
            // Normalise raw segment data from Duffel-style or flat array on rawOffer
            const rawSegs: unknown[] | undefined =
              offer.rawOffer?.slices?.[0]?.segments ??
              (Array.isArray(offer.rawOffer?.segments) ? offer.rawOffer.segments : undefined);

            if (!rawSegs || rawSegs.length < 2) return null;

            // Map to FlightSegment — handle both Duffel and generic formats
            const segments: FlightSegment[] = rawSegs
              .map((s: any) => ({
                departureIata:
                  s.origin?.iata_code ?? s.departure_iata ?? s.departureIata ?? "",
                arrivalIata:
                  s.destination?.iata_code ?? s.arrival_iata ?? s.arrivalIata ?? "",
                departureTime:
                  s.departing_at ?? s.departure_at ?? s.departureTime ?? "",
                arrivalTime:
                  s.arriving_at ?? s.arrival_at ?? s.arrivalTime ?? "",
                durationMinutes:
                  s.duration ?? s.durationMinutes ?? undefined,
                carrierCode:
                  s.operating_carrier?.iata_code ?? s.airline ?? s.carrierCode ?? undefined,
              }))
              .filter((s) => s.departureIata && s.arrivalIata);

            if (segments.length < 2) return null;

            const layovers = getFlightLayovers(segments);

            return (
              <div className="rounded-xl border border-border/80 bg-card/40 overflow-hidden">
                <div className="border-b border-border/60 px-4 py-2.5 flex items-center gap-2">
                  <Plane className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Flight Itinerary</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {segments.length} leg{segments.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="p-3 space-y-1">
                  {segments.map((seg, idx) => {
                    const legOffset = getArrivalDayOffset(
                      seg.departureTime.split("T")[1]?.slice(0, 5) ?? "00:00",
                      seg.durationMinutes ?? 0,
                    );
                    const layover = layovers[idx]; // layover AFTER this leg

                    return (
                      <div key={idx}>
                        {/* Leg row */}
                        <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-card/60 transition-colors">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                            {idx + 1}
                          </div>
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {seg.departureIata}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="font-mono text-xs font-bold text-foreground">
                              {seg.arrivalIata}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                            {seg.departureTime && (
                              <span className="font-mono">
                                {seg.departureTime.split("T")[1]?.slice(0, 5) ?? ""}
                              </span>
                            )}
                            {seg.durationMinutes ? (
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatFlightDuration(seg.durationMinutes)}
                              </span>
                            ) : null}
                            {legOffset > 0 && (
                              <span className="rounded bg-amber-500/15 px-1 text-[10px] font-bold text-amber-400">
                                +{legOffset}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Layover callout between this leg and the next */}
                        {layover && (
                          <div
                            className={cn(
                              "mx-2 my-1 flex items-center gap-2 rounded-lg border px-3 py-1.5",
                              layover.isOvernight
                                ? "border-amber-500/30 bg-amber-500/8"
                                : "border-blue-500/25 bg-blue-500/8",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                layover.isOvernight
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-blue-500/20 text-blue-400",
                              )}
                            >
                              {layover.isOvernight ? (
                                <Moon className="h-2.5 w-2.5" />
                              ) : (
                                <Clock className="h-2.5 w-2.5" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                layover.isOvernight ? "text-amber-300" : "text-blue-300",
                              )}
                            >
                              {layover.isOvernight ? "Overnight layover" : "Layover"} in{" "}
                              <span className="font-mono font-bold">
                                {layover.airportCode}
                              </span>{" "}
                              — {layover.formattedDuration}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Provider Selection Options */}
          <div className="space-y-3 pt-1">
            <div className="group relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-4 transition-all hover:border-primary hover:shadow-lg sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-base font-bold text-foreground">
                      Aviasales Metasearch Engine
                    </span>
                    <Badge className="bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                      Recommended
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Opens verified live fares across Aviasales partner sellers, including Trip.com,
                    Kiwi, eDreams, and official airlines.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-success font-medium">
                      <Check className="h-3.5 w-3.5" />
                      Partner link includes marker=778298
                    </span>
                    <span>•</span>
                    <span>Best for matching the displayed fare</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                  <span className="text-lg font-extrabold text-foreground sm:text-xl">
                    {formatCurrencyAmount(displayPrice, currency)}
                  </span>
                  <Button
                    type="button"
                    onClick={handleBookAviasales}
                    className="glow-cta w-full gap-1.5 rounded-xl font-bold shadow-md sm:w-auto"
                    size="sm"
                  >
                    <span>Open Aviasales</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-4 transition-all hover:border-border hover:bg-card/70 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                    <span className="text-base font-bold text-foreground">
                      Skyscanner Comparison
                    </span>
                    <Badge
                      variant="outline"
                      className="border-border text-[10px] text-muted-foreground"
                    >
                      Fallback
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Opens a filtered comparison page for this route, carrier, stops, cabin, and
                    departure window.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      Useful for cross-checking prices
                    </span>
                    <span>•</span>
                    <span>Fares may differ from the Aviasales result</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBookSkyscanner}
                  className="w-full gap-1.5 rounded-xl border-border font-semibold hover:bg-accent sm:w-auto"
                  size="sm"
                >
                  <span>Compare on Skyscanner</span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Guarantee */}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              FlightIQ never charges booking fees or adds markups. Fares are subject to airline
              availability.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
