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
import {
  ExternalLink,
  Clock,
  Plane,
  ShieldCheck,
  Check,
  Sparkles,
  Building2,
  Calendar,
} from "lucide-react";
import { formatPrice } from "@/lib/currency";
import { formatDuration, type FlightOffer, type SearchParams } from "@/lib/flights";
import { buildSkyscannerDeepLink, getAirlineWebsite } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface BookingProviderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: FlightOffer;
  searchParams: SearchParams;
  currency: string;
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

  const departureTime =
    rawSegments?.[0]?.departing_at ??
    offer.departingAt ??
    offer.departTime;

  const isDirect = stops === 0;
  const stopoverText = isDirect
    ? "Direct / Nonstop"
    : stops === 1
      ? "1 Stopover"
      : `${stops} Stopovers`;

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

  const airlineWebsiteUrl = getAirlineWebsite(offer.airlineCode, offer.airline);

  function handleBookSkyscanner() {
    trackAffiliateClick({
      airline: offer.airline,
      price: offer.priceUsd,
      currency,
      skyscanner_deep_link: skyscannerUrl,
    });
    window.open(skyscannerUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  function handleBookAirlineDirect() {
    trackAffiliateClick({
      airline: offer.airline,
      price: offer.priceUsd,
      currency,
      skyscanner_deep_link: airlineWebsiteUrl,
    });
    window.open(airlineWebsiteUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  function handleBookOption(opt: { providerName: string; priceUsd: number; deepLink: string }) {
    trackAffiliateClick({
      airline: offer.airline,
      price: opt.priceUsd,
      currency,
      skyscanner_deep_link: opt.deepLink,
    });
    window.open(opt.deepLink, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl">
        {/* Header Banner */}
        <div className="border-b border-border/70 bg-gradient-to-br from-card/80 via-card/50 to-primary/5 p-6 sm:p-7">
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
                  {formatPrice(offer.priceUsd, currency)}
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
                {formatDuration(offer.durationMinutes)}
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
              Prices and availability are verified with our partner booking platforms. Choose your
              preferred booking provider below to complete your reservation.
            </DialogDescription>
          </div>

          {/* Provider Selection Options */}
          <div className="space-y-3 pt-1">
            {offer.bookingOptions && offer.bookingOptions.length > 0 ? (
              // Multi-provider pricing from Travelpayouts (Trip.com, Kiwi, Airline Direct, etc.)
              offer.bookingOptions.map((opt, idx) => (
                <div
                  key={opt.providerId || idx}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-lg",
                    opt.isRecommended
                      ? "border-2 border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent hover:border-primary"
                      : "border-border/80 bg-card/40 hover:border-border hover:bg-card/70",
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg",
                            opt.isRecommended
                              ? "bg-primary/20 text-primary"
                              : opt.isCarrierDirect
                                ? "bg-muted text-muted-foreground"
                                : "bg-sky-500/20 text-sky-400",
                          )}
                        >
                          {opt.isCarrierDirect ? (
                            <Building2 className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </div>
                        <span className="font-bold text-foreground text-base">
                          {opt.providerName}
                        </span>
                        {opt.isRecommended && (
                          <Badge className="bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wide">
                            Best Fare
                          </Badge>
                        )}
                        {opt.isCarrierDirect && !opt.isRecommended && (
                          <Badge
                            variant="outline"
                            className="border-border text-[10px] text-muted-foreground"
                          >
                            Official Airline
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {opt.isCarrierDirect
                          ? `Direct reservation on ${offer.airline}'s official booking portal.`
                          : `Verified OTA partner fare with instant e-ticket issuance.`}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 text-success font-medium">
                          <Check className="h-3.5 w-3.5" />
                          100% Price Parity Guaranteed
                        </span>
                        <span>•</span>
                        <span>Pre-monetized Direct Link</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center sm:flex-col sm:items-end gap-2">
                      <span className="text-lg font-extrabold text-foreground sm:text-xl">
                        {formatPrice(opt.priceUsd, currency)}
                      </span>
                      <Button
                        type="button"
                        onClick={() => handleBookOption(opt)}
                        className={cn(
                          "gap-1.5 rounded-xl font-bold shadow-md w-full sm:w-auto",
                          opt.isRecommended ? "glow-cta" : "variant-outline border-border",
                        )}
                        size="sm"
                      >
                        <span>Book on {opt.providerName}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              // Default Fallback Providers
              <>
                {/* Option 1: Skyscanner (Recommended) */}
                <div className="group relative overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 transition-all hover:border-primary hover:shadow-lg">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-foreground text-base">Skyscanner</span>
                        <Badge className="bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase tracking-wide">
                          Recommended
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Matches exact flight ({stopoverText.toLowerCase()} · departing {offer.departTime} window).
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 text-success">
                          <Check className="h-3.5 w-3.5" />
                          Verified {formatPrice(offer.priceUsd, currency)} fare
                        </span>
                        <span>•</span>
                        <span>Multiple OTA comparisons</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center sm:flex-col sm:items-end gap-2">
                      <span className="text-lg font-extrabold text-foreground sm:text-xl">
                        {formatPrice(offer.priceUsd, currency)}
                      </span>
                      <Button
                        type="button"
                        onClick={handleBookSkyscanner}
                        className="glow-cta gap-1.5 rounded-xl font-bold shadow-md w-full sm:w-auto"
                        size="sm"
                      >
                        <span>Book on Skyscanner</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Option 2: Official Airline Site (Fallback Direct) */}
                <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5 transition-all hover:border-border hover:bg-card/70">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-foreground text-sm sm:text-base">
                          {offer.airline} Direct
                        </span>
                        <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                          Official Airline
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Book directly on {offer.airline}’s official reservation portal.
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Check className="h-3.5 w-3.5 text-primary" />
                          Earn airline frequent flyer miles
                        </span>
                        <span>•</span>
                        <span>Direct airline support & rebooking</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center sm:flex-col sm:items-end gap-2">
                      <span className="text-xs text-muted-foreground font-medium hidden sm:block">
                        Direct carrier fare
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleBookAirlineDirect}
                        className="gap-1.5 rounded-xl border-border hover:bg-accent font-semibold w-full sm:w-auto"
                        size="sm"
                      >
                        <span>Visit Official Site</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Guarantee */}
          <div className="pt-2 text-center">
            <p className="text-[11px] text-muted-foreground">
              FlightIQ never charges booking fees or adds markups. Fares are subject to airline availability.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
