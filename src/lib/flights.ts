/**
 * flights.ts
 * Core FlightIQ domain types and presentation formatting helpers.
 * Safe for client-side and server-side consumption.
 */

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type SearchParams = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType: "round" | "oneway";
  adults: number;
  cabin: "economy" | "premium" | "business" | "first";
  cabinClass?: string;
  currency?: string;
};

export type SearchLiveFlightsParams = {
  originIata: string;
  destinationIata: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null | undefined; // YYYY-MM-DD
  adults: number;
  cabinClass: "economy" | "premium_economy" | "business" | "first" | "premium";
  currency?: string | undefined;
};

export type FlightBookingOption = {
  providerId: string;
  providerName: string;
  providerType?: "ota" | "airline" | "meta";
  priceUsd: number;
  deepLink: string;
  isCarrierDirect?: boolean;
  isRecommended?: boolean;
};

export type FlightOffer = {
  id: string;
  airline: string;
  airlineCode: string;
  airlineLogo?: string | null | undefined;
  /** Base price in USD (lowest available across providers); converted at render time. */
  priceUsd: number;
  /** Typical price for this route in USD, used to show price drops. */
  baselineUsd: number;
  dropPercent: number;
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
  stops: number;
  origin: string;
  destination: string;
  bestLocalFare: boolean;
  skyscanner_link?: string | undefined;
  deepLink?: string | undefined;
  departingAt?: string | undefined;
  rawOffer?: any;
  /** Multi-provider booking options from aggregators & OTAs (e.g. Trip.com, Kiwi, Airline Direct) */
  bookingOptions?: FlightBookingOption[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses ISO 8601 duration string (e.g. "PT2H30M", "PT14H", "PT45M") into minutes. */
export function parseIsoDuration(durationStr?: string | null): number {
  if (!durationStr) return 0;
  const match = durationStr.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const days = parseInt(match[1] || "0", 10);
  const hours = parseInt(match[2] || "0", 10);
  const minutes = parseInt(match[3] || "0", 10);
  return days * 1440 + hours * 60 + minutes;
}

/** Extracts "HH:MM" time from an ISO datetime string (e.g. "2024-10-01T14:30:00"). */
export function formatIsoTime(isoStr?: string | null): string {
  if (!isoStr) return "--:--";
  const timePart = isoStr.split("T")[1] ?? "";
  return timePart.slice(0, 5);
}

/** Formats total minutes into a human-readable label (e.g. "2h 30m"). */
export function formatDuration(mins: number): string {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}
