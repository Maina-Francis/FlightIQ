import { createFileRoute, useSearch, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { FlightCard } from "@/components/flight-card";
import { AlertModal } from "@/components/alert-modal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { searchFlights } from "@/lib/flights.functions";
import { type FlightOffer, type SearchParams } from "@/lib/flights";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { findAirport } from "@/lib/airports";
import { formatPrice, getCurrency } from "@/lib/currency";
import {
  ArrowLeft,
  Filter,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Zap,
  DollarSign,
  Plane,
  Clock,
  Sun,
  Sunset,
  Moon,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function FlightCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl border border-border/70 p-5 sm:p-6 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-muted/60 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-muted/60" />
            <div className="h-3 w-24 rounded bg-muted/40" />
          </div>
        </div>
        <div className="h-6 w-28 rounded-full bg-muted/40" />
      </div>
      <div className="mt-6 rounded-xl bg-card/40 p-4">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
          <div className="space-y-2">
            <div className="h-7 w-16 rounded bg-muted/60" />
            <div className="h-4 w-12 rounded bg-muted/40" />
          </div>
          <div className="flex flex-col items-center gap-2 px-2">
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="h-0.5 w-full rounded bg-muted/50" />
            <div className="h-5 w-16 rounded-full bg-muted/40" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-7 w-16 rounded bg-muted/60" />
            <div className="h-4 w-12 rounded bg-muted/40" />
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border/80 pt-4">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-muted/60" />
          <div className="h-3 w-24 rounded bg-muted/40" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-xl bg-muted/50" />
          <div className="h-9 w-28 rounded-xl bg-primary/30" />
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Results — FlightIQ" },
      {
        name: "description",
        content: "Compare flight fares and track price drops for your route.",
      },
    ],
  }),
  component: SearchPage,
});

type SearchQuery = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType: "round" | "oneway";
  adults: number;
  cabin: SearchParams["cabin"];
};

type SortTab = "cheapest" | "fastest" | "best_value";
type TimeOfDay = "all" | "morning" | "afternoon" | "evening" | "night";

function SearchPage() {
  const search = useSearch({ from: "/search" }) as SearchQuery;
  const { currency } = useCurrencyStore();
  const { hydrate: hydrateTheme } = useThemeStore();

  const searchParams: SearchParams = useMemo(
    () => ({
      origin: search.origin || "NBO",
      destination: search.destination || "CPT",
      departureDate: search.departureDate || new Date().toISOString().split("T")[0]!,
      returnDate: search.returnDate ?? null,
      tripType: search.tripType || "round",
      adults: Number(search.adults) || 1,
      cabin: search.cabin || "economy",
      currency: currency || "USD",
    }),
    [search, currency],
  );

  // ── Live flight fetch via TanStack Query + server function ──
  const {
    data: offers = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["flights", searchParams],
    queryFn: () => searchFlights({ data: searchParams }),
    staleTime: 5 * 60 * 1000, // cache results for 5 minutes
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // Notify user via toast on live search failure
  useEffect(() => {
    if (isError && error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to fetch live flight offers. Please check your connection and try again.",
        { id: "flight-search-error", duration: 6000 },
      );
    }
  }, [isError, error]);

  // Sort State: "Cheapest" | "Fastest" | "Best Value"
  const [activeSort, setActiveSort] = useState<SortTab>("cheapest");

  // Filter States
  const [selectedStops, setSelectedStops] = useState<"all" | "direct" | "1stop">("all");
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<TimeOfDay>("all");
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Price Alert Modal State
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertOffer, setAlertOffer] = useState<FlightOffer | null>(null);

  useEffect(() => {
    hydrateTheme();
    initAnalytics();
    trackPageView("/search");
  }, [hydrateTheme]);

  // Calculate currency-adjusted min & max prices for slider bounds
  const currencyRate = getCurrency(currency).rate;
  const minOfferPrice = useMemo(() => {
    if (offers.length === 0) return 0;
    return Math.floor(Math.min(...offers.map((o) => o.priceUsd * currencyRate)));
  }, [offers, currencyRate]);

  const maxOfferPrice = useMemo(() => {
    if (offers.length === 0) return 1000;
    return Math.ceil(Math.max(...offers.map((o) => o.priceUsd * currencyRate)));
  }, [offers, currencyRate]);

  useEffect(() => {
    setPriceRange([minOfferPrice, maxOfferPrice]);
  }, [minOfferPrice, maxOfferPrice]);

  // Airlines list with count
  const airlinesWithCounts = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    offers.forEach((o) => {
      const current = map.get(o.airlineCode);
      if (current) {
        current.count += 1;
      } else {
        map.set(o.airlineCode, { name: o.airline, count: 1 });
      }
    });
    return Array.from(map.entries());
  }, [offers]);

  // Filter logic
  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      // Filter by Stops
      if (selectedStops === "direct" && offer.stops !== 0) return false;
      if (selectedStops === "1stop" && offer.stops !== 1) return false;

      // Filter by Departure Time of Day
      if (selectedTimeOfDay !== "all") {
        const hour = parseInt(offer.departTime.split(":")[0] ?? "0", 10);
        if (selectedTimeOfDay === "morning" && (hour < 6 || hour >= 12)) return false;
        if (selectedTimeOfDay === "afternoon" && (hour < 12 || hour >= 18)) return false;
        if (selectedTimeOfDay === "evening" && (hour < 18 || hour >= 24)) return false;
        if (selectedTimeOfDay === "night" && (hour < 0 || hour >= 6)) return false;
      }

      // Filter by Airline
      if (selectedAirlines.size > 0 && !selectedAirlines.has(offer.airlineCode)) {
        return false;
      }

      // Filter by Price
      const convertedPrice = offer.priceUsd * currencyRate;
      if (convertedPrice < priceRange[0] || convertedPrice > priceRange[1]) {
        return false;
      }

      return true;
    });
  }, [offers, selectedStops, selectedTimeOfDay, selectedAirlines, priceRange, currencyRate]);

  // Sorting logic: Cheapest, Fastest, Best Value
  const sortedOffers = useMemo(() => {
    if (filteredOffers.length === 0) return [];
    const minPrice = Math.min(...filteredOffers.map((o) => o.priceUsd));
    const minDuration = Math.min(...filteredOffers.map((o) => o.durationMinutes));

    return [...filteredOffers].sort((a, b) => {
      if (activeSort === "cheapest") {
        return a.priceUsd - b.priceUsd;
      }
      if (activeSort === "fastest") {
        return a.durationMinutes - b.durationMinutes;
      }
      // "best_value": Balanced score (price + duration - price drop discount)
      const scoreA =
        (a.priceUsd / (minPrice || 1)) * 0.6 +
        (a.durationMinutes / (minDuration || 1)) * 0.4 -
        (a.dropPercent / 100) * 0.2;
      const scoreB =
        (b.priceUsd / (minPrice || 1)) * 0.6 +
        (b.durationMinutes / (minDuration || 1)) * 0.4 -
        (b.dropPercent / 100) * 0.2;
      return scoreA - scoreB;
    });
  }, [filteredOffers, activeSort]);

  function handleResetFilters() {
    setSelectedStops("all");
    setSelectedTimeOfDay("all");
    setSelectedAirlines(new Set());
    setPriceRange([minOfferPrice, maxOfferPrice]);
  }

  function toggleAirline(code: string) {
    setSelectedAirlines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleTrackPrice(offer: FlightOffer) {
    setAlertOffer(offer);
    setAlertOpen(true);
  }

  const originAirport = findAirport(searchParams.origin);
  const destAirport = findAirport(searchParams.destination);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Search Header Banner */}
      <div className="border-b border-border/80 bg-card/30 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-lg">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                <span>Change Search</span>
              </Link>
            </Button>
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-foreground">
                  {searchParams.origin}
                </span>
                <span className="text-primary font-bold">→</span>
                <span className="font-mono text-base font-bold text-foreground">
                  {searchParams.destination}
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold capitalize text-primary">
                  {searchParams.tripType === "round" ? "Round Trip" : "One Way"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {originAirport
                  ? `${originAirport.city} (${originAirport.iata})`
                  : searchParams.origin}{" "}
                to{" "}
                {destAirport
                  ? `${destAirport.city} (${destAirport.iata})`
                  : searchParams.destination}{" "}
                · {searchParams.departureDate}
                {searchParams.returnDate ? ` — ${searchParams.returnDate}` : ""} ·{" "}
                {searchParams.adults} {searchParams.adults === 1 ? "adult" : "adults"} ·{" "}
                <span className="capitalize">{searchParams.cabin}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden gap-1.5"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              <span>Filters ({filteredOffers.length})</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setAlertOffer(sortedOffers[0] ?? null);
                setAlertOpen(true);
              }}
              className="glow-cta gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span>Track Route</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Sidebar + Results */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          {/* Filter Sidebar — Desktop */}
          <aside className="hidden space-y-6 lg:block">
            <div className="glass-panel sticky top-24 rounded-2xl border border-border/80 p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span>Filter Flights</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="space-y-6">
                {/* Stops Filter */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Stops
                  </Label>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedStops("all")}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                        selectedStops === "all"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStops("direct")}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                        selectedStops === "direct"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      Direct
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStops("1stop")}
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                        selectedStops === "1stop"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      1 Stop
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Departure Time Range */}
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Departure Time
                  </Label>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTimeOfDay(selectedTimeOfDay === "morning" ? "all" : "morning")
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                        selectedTimeOfDay === "morning"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Sun className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Morning</p>
                        <p className="text-[10px] text-muted-foreground">06:00 - 12:00</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTimeOfDay(
                          selectedTimeOfDay === "afternoon" ? "all" : "afternoon",
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                        selectedTimeOfDay === "afternoon"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Sunset className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Afternoon</p>
                        <p className="text-[10px] text-muted-foreground">12:00 - 18:00</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTimeOfDay(selectedTimeOfDay === "evening" ? "all" : "evening")
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                        selectedTimeOfDay === "evening"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Moon className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Evening</p>
                        <p className="text-[10px] text-muted-foreground">18:00 - 24:00</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTimeOfDay(selectedTimeOfDay === "night" ? "all" : "night")
                      }
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                        selectedTimeOfDay === "night"
                          ? "border-primary bg-primary/15 font-semibold text-primary"
                          : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        <p className="font-medium text-foreground">Night</p>
                        <p className="text-[10px] text-muted-foreground">00:00 - 06:00</p>
                      </div>
                    </button>
                  </div>
                </div>

                <Separator />

                {/* Price Range Slider */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Price Range
                    </Label>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {formatPrice(priceRange[1] / currencyRate, currency)}
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <Slider
                      minStepsBetweenThumbs={1}
                      min={minOfferPrice}
                      max={maxOfferPrice}
                      step={Math.max(1, Math.floor((maxOfferPrice - minOfferPrice) / 100))}
                      value={priceRange}
                      onValueChange={(val) =>
                        setPriceRange([val[0] ?? minOfferPrice, val[1] ?? maxOfferPrice])
                      }
                      className="my-3"
                    />
                    <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                      <span>{formatPrice(priceRange[0] / currencyRate, currency)}</span>
                      <span>{formatPrice(priceRange[1] / currencyRate, currency)}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Airlines Checkboxes */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Airlines
                    </Label>
                    {selectedAirlines.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedAirlines(new Set())}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {airlinesWithCounts.map(([code, { name, count }]) => (
                      <label
                        key={code}
                        className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-accent/50 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            checked={selectedAirlines.has(code)}
                            onCheckedChange={() => toggleAirline(code)}
                          />
                          <span className="font-semibold text-foreground">{code}</span>
                          <span className="text-muted-foreground line-clamp-1">{name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          ({count})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Filter Drawer — Mobile */}
          <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen} direction="bottom">
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="flex flex-row items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <DrawerTitle className="text-base font-bold">Filter Flights</DrawerTitle>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6">
                <div className="space-y-6">
                  {/* Stops Filter */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Stops
                    </Label>
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedStops("all")}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                          selectedStops === "all"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStops("direct")}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                          selectedStops === "direct"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        Direct
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStops("1stop")}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-center text-xs font-medium transition-all",
                          selectedStops === "1stop"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        1 Stop
                      </button>
                    </div>
                  </div>

                  <Separator />

                  {/* Departure Time Range */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Departure Time
                    </Label>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTimeOfDay(selectedTimeOfDay === "morning" ? "all" : "morning")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                          selectedTimeOfDay === "morning"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Sun className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Morning</p>
                          <p className="text-[10px] text-muted-foreground">06:00 - 12:00</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTimeOfDay(selectedTimeOfDay === "afternoon" ? "all" : "afternoon")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                          selectedTimeOfDay === "afternoon"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Sunset className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Afternoon</p>
                          <p className="text-[10px] text-muted-foreground">12:00 - 18:00</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTimeOfDay(selectedTimeOfDay === "evening" ? "all" : "evening")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                          selectedTimeOfDay === "evening"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Moon className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Evening</p>
                          <p className="text-[10px] text-muted-foreground">18:00 - 24:00</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTimeOfDay(selectedTimeOfDay === "night" ? "all" : "night")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-all",
                          selectedTimeOfDay === "night"
                            ? "border-primary bg-primary/15 font-semibold text-primary"
                            : "border-border bg-card/50 text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <div>
                          <p className="font-medium text-foreground">Night</p>
                          <p className="text-[10px] text-muted-foreground">00:00 - 06:00</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <Separator />

                  {/* Price Range Slider */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Price Range
                      </Label>
                      <span className="text-xs font-mono font-bold text-foreground">
                        {formatPrice(priceRange[1] / currencyRate, currency)}
                      </span>
                    </div>
                    <div className="mt-3.5">
                      <Slider
                        minStepsBetweenThumbs={1}
                        min={minOfferPrice}
                        max={maxOfferPrice}
                        step={Math.max(1, Math.floor((maxOfferPrice - minOfferPrice) / 100))}
                        value={priceRange}
                        onValueChange={(val) =>
                          setPriceRange([val[0] ?? minOfferPrice, val[1] ?? maxOfferPrice])
                        }
                        className="my-3"
                      />
                      <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                        <span>{formatPrice(priceRange[0] / currencyRate, currency)}</span>
                        <span>{formatPrice(priceRange[1] / currencyRate, currency)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Airlines */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Airlines
                      </Label>
                      {selectedAirlines.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedAirlines(new Set())}
                          className="text-[11px] font-medium text-primary hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {airlinesWithCounts.map(([code, { name, count }]) => (
                        <label
                          key={code}
                          className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-accent/50 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={selectedAirlines.has(code)}
                              onCheckedChange={() => toggleAirline(code)}
                            />
                            <span className="font-semibold text-foreground">{code}</span>
                            <span className="text-muted-foreground line-clamp-1">{name}</span>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            ({count})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full glow-cta"
                  >
                    Show {filteredOffers.length} {filteredOffers.length === 1 ? "flight" : "flights"}
                  </Button>
                </div>
              </div>
            </DrawerContent>
          </Drawer>

          {/* Results Column */}
          <div>
            {/* Sort Header Tabs */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isLoading
                    ? "Searching live fares…"
                    : `${sortedOffers.length} ${sortedOffers.length === 1 ? "flight deal" : "flight deals"} available`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isLoading
                    ? "Checking airlines and prices in real time."
                    : "All fares include taxes and airline booking fees. Real-time partner pricing."}
                </p>
              </div>

              {/* Segmented Sort Header Tabs */}
              <div className="flex items-center rounded-xl border border-border bg-card/60 p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setActiveSort("cheapest")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    activeSort === "cheapest"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Cheapest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSort("fastest")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    activeSort === "fastest"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Fastest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSort("best_value")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    activeSort === "best_value"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Best Value</span>
                </button>
              </div>
            </div>

            {/* Flight Cards List */}
            {isLoading ? (
              // ── Loading: shimmer skeletons ──────────────────────────────
              <div className="space-y-4">
                <FlightCardSkeleton />
                <FlightCardSkeleton />
                <FlightCardSkeleton />
              </div>
            ) : isError ? (
              // ── Error: fetch failed ────────────────────────────────────
              <div className="glass-panel rounded-2xl border border-destructive/30 bg-destructive/5 p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  Couldn't fetch flights
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  {error instanceof Error
                    ? error.message
                    : "Something went wrong while searching for flights. Please try again."}
                </p>
                <Button
                  onClick={() => refetch()}
                  variant="outline"
                  size="sm"
                  className="mt-5 gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry search
                </Button>
              </div>
            ) : offers.length === 0 ? (
              // ── Empty: Duffel returned 0 live flights on route ───────────
              <div className="glass-panel rounded-2xl border border-border/80 p-12 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plane className="h-6 w-6 rotate-45" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  No live flights found
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  No live flights were found for {originAirport?.name ?? searchParams.origin} (
                  {searchParams.origin}) to {destAirport?.name ?? searchParams.destination} (
                  {searchParams.destination}) on {searchParams.departureDate}. Try searching with different dates or nearby airports.
                </p>
                <Link to="/">
                  <Button variant="outline" size="sm" className="mt-5 gap-2">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Modify search
                  </Button>
                </Link>
              </div>
            ) : sortedOffers.length === 0 ? (
              // ── Empty: user filters eliminated all results ─────────────
              <div className="glass-panel rounded-2xl border border-border/80 p-12 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">
                  No flights match your filters
                </h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Try broadening your stops, departure time, or price range to
                  view available airline deals.
                </p>
                <Button
                  onClick={handleResetFilters}
                  variant="outline"
                  size="sm"
                  className="mt-5"
                >
                  Reset all filters
                </Button>
              </div>
            ) : (
              // ── Results ────────────────────────────────────────────────
              <div className="space-y-4">
                {sortedOffers.map((offer) => (
                  <FlightCard
                    key={offer.id}
                    offer={offer}
                    searchParams={searchParams}
                    currency={currency}
                    onTrackPrice={handleTrackPrice}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Alert Subscription Modal */}
      {alertOffer && (
        <AlertModal
          open={alertOpen}
          onOpenChange={setAlertOpen}
          origin={searchParams.origin}
          destination={searchParams.destination}
          departureDate={searchParams.departureDate}
          returnDate={searchParams.returnDate}
          currency={currency}
          currentPriceUsd={alertOffer.priceUsd}
        />
      )}
    </div>
  );
}
