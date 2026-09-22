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
  price: number;
  currency: string;
  deepLink: string;
  isCarrierDirect?: boolean;
  isRecommended?: boolean;
};

export type FlightOffer = {
  id: string;
  airline: string;
  airlineCode: string;
  airlineLogo?: string | null | undefined;
  /** Lowest available fare in `currency`, as returned by the flight provider. */
  price: number;
  /** Typical fare in `currency`, used to show price drops. */
  baselinePrice: number;
  currency: string;
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


/**
 * Formats total minutes into a human-readable duration label.
 *
 * Rules:
 *  ≥ 1440 min (24 h) → "Xd Yh Zm"   (e.g. 3545 → "2d 11h 5m")
 *  ≥ 60 min          → "Yh Zm"       (e.g. 450  → "7h 30m", 480 → "8h")
 *  < 60 min          → "Zm"           (e.g. 45   → "45m")
 *  0 or invalid      → "0m"
 *
 * Zero-value components are omitted except when the entire value is zero:
 *   1440 → "1d"  (not "1d 0h 0m")
 *   480  → "8h"  (not "8h 0m")
 */
export function formatFlightDuration(mins: number | undefined | null): string {
  if (mins == null || !Number.isFinite(mins) || mins < 0) return "—";
  const m = Math.round(mins);
  if (m === 0) return "0m";

  const days = Math.floor(m / 1440);
  const hours = Math.floor((m % 1440) / 60);
  const minutes = m % 60;

  if (days > 0) {
    const parts: string[] = [`${days}d`];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(" ");
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/** Backward-compatible alias — existing imports keep working unchanged. */
export const formatDuration = formatFlightDuration;

// ─── Segment & Layover Types ──────────────────────────────────────────────────

/** A single flight leg within a multi-stop itinerary. */
export type FlightSegment = {
  /** IATA code of this leg's departure airport (e.g. "NBO"). */
  departureIata: string;
  /** IATA code of this leg's arrival airport (e.g. "DXB"). */
  arrivalIata: string;
  /** ISO datetime string of departure (e.g. "2026-10-01T22:00:00"). */
  departureTime: string;
  /** ISO datetime string of arrival (e.g. "2026-10-02T06:30:00"). */
  arrivalTime: string;
  /** Flight duration in minutes (leg only). */
  durationMinutes?: number;
  /** Carrier code for this leg (e.g. "EK"). */
  carrierCode?: string;
};

/** A computed layover between two consecutive flight segments. */
export type Layover = {
  /** IATA code of the connecting airport (arrival of seg N = departure of seg N+1). */
  airportCode: string;
  /** Ground time at the connecting airport in minutes. */
  durationMinutes: number;
  /** Human-readable duration label (e.g. "2h 30m"). */
  formattedDuration: string;
  /**
   * True when the layover is ≥ 8 hours (480 min) OR the clock crosses midnight
   * at the connecting airport (local UTC). Signals potential overnight stay.
   */
  isOvernight: boolean;
};

/**
 * Computes structured layover objects from an ordered array of flight segments.
 *
 * @param segments - Ordered list of flight legs (at least 2 required).
 * @returns Array of Layover objects — one per connection. Empty array for direct flights.
 */
export function getFlightLayovers(segments: FlightSegment[]): Layover[] {
  if (!Array.isArray(segments) || segments.length < 2) return [];

  const layovers: Layover[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const curr = segments[i];
    const next = segments[i + 1];

    if (!curr?.arrivalTime || !next?.departureTime) continue;

    const arrDate = new Date(curr.arrivalTime);
    const depDate = new Date(next.departureTime);

    if (isNaN(arrDate.getTime()) || isNaN(depDate.getTime())) continue;

    const durationMinutes = Math.round(
      (depDate.getTime() - arrDate.getTime()) / 60_000,
    );

    // Discard negative layovers (data anomaly / clock skew)
    if (durationMinutes < 0) continue;

    // Overnight: ≥ 8 h OR the UTC hour "rolled back" across midnight
    const arrHour = arrDate.getUTCHours();
    const depHour = depDate.getUTCHours();
    const crossesMidnight =
      depDate.getUTCDate() !== arrDate.getUTCDate() ||
      depDate.getUTCMonth() !== arrDate.getUTCMonth();
    const isOvernight = durationMinutes >= 480 || crossesMidnight || depHour < arrHour;

    layovers.push({
      airportCode: curr.arrivalIata,
      durationMinutes,
      formattedDuration: formatFlightDuration(durationMinutes),
      isOvernight,
    });
  }

  return layovers;
}

/**
 * Computes how many calendar days past the departure date the arrival falls on.
 * Used to display "+1", "+2" badges on flight cards for multi-day itineraries.
 *
 * @param departTimeHHMM  - "HH:MM" string (e.g. "22:30")
 * @param durationMinutes - Total flight duration in minutes
 * @returns 0 for same-day arrival, 1 for next-day, etc.
 */
export function getArrivalDayOffset(
  departTimeHHMM: string,
  durationMinutes: number,
): number {
  if (!departTimeHHMM || !durationMinutes) return 0;
  const parts = departTimeHHMM.split(":");
  const depH = parseInt(parts[0] ?? "0", 10);
  const depM = parseInt(parts[1] ?? "0", 10);
  if (isNaN(depH) || isNaN(depM)) return 0;
  const depTotalMins = depH * 60 + depM;
  return Math.floor((depTotalMins + Math.round(durationMinutes)) / 1440);
}

