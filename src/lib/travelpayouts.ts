/**
 * travelpayouts.ts
 * Travelpayouts (Aviasales Flight Search API) client & MD5 signature generator.
 *
 * Provides:
 * 1. MD5 Signature generator matching Aviasales Search API specification.
 * 2. Autocomplete Places API integration (autocomplete.travelpayouts.com).
 * 3. Flight Search API v1 initiation & polling with multi-provider pricing.
 */

import crypto from "crypto";
import type { FlightBookingOption, SearchLiveFlightsParams } from "./flights";
import { getCurrency } from "./currency";

export const TRAVELPAYOUTS_TOKEN: string =
  process.env["TRAVELPAYOUTS_TOKEN"] ?? "";
export const TRAVELPAYOUTS_MARKER: string =
  process.env["TRAVELPAYOUTS_MARKER"] ?? "";

export function isTravelpayoutsConfigured(): boolean {
  return Boolean(TRAVELPAYOUTS_TOKEN && TRAVELPAYOUTS_MARKER);
}

// ─── MD5 Signature Generator Helper ──────────────────────────────────────────

export interface AviasalesSignatureParams {
  currency_code: string;
  locale: string;
  market_code: string;
  origin: string;
  destination: string;
  date: string;
  return_date?: string | undefined;
  adults: number;
  children?: number | undefined;
  infants?: number | undefined;
  trip_class?: string | undefined; // 'Y' = Economy, 'C' = Business
}

/**
 * Generates an MD5 signature for Aviasales Flight Search API.
 * Values are concatenated in exact alphabetical order of key parameter names:
 * Order: TOKEN:currency_code:locale:marker:market_code:date:destination:origin:return_date:adults:children:infants:trip_class
 */
export function generateAviasalesSignature(
  token: string,
  marker: string,
  params: AviasalesSignatureParams,
): string {
  const rawString = [
    token,
    params.currency_code,
    params.locale,
    marker,
    params.market_code,
    params.date,
    params.destination,
    params.origin,
    params.return_date || "",
    params.adults,
    params.children || 0,
    params.infants || 0,
    params.trip_class || "Y",
  ]
    .filter((val) => val !== undefined)
    .join(":");

  return crypto.createHash("md5").update(rawString).digest("hex");
}

// ─── Travelpayouts Places Autocomplete API ────────────────────────────────────

export interface TravelpayoutsPlace {
  id: string;
  type: "city" | "airport" | "country";
  code: string;
  name: string;
  country_code?: string | undefined;
  country_name?: string | undefined;
  city_code?: string | undefined;
  city_name?: string | undefined;
  state_code?: string | null | undefined;
  main_airport_name?: string | null | undefined;
}

/**
 * Searches places (airports and cities) using Travelpayouts public autocomplete API.
 */
export async function searchTravelpayoutsPlaces(
  query: string,
  locale = "en",
): Promise<TravelpayoutsPlace[]> {
  const term = query.trim();
  if (!term) return [];

  const url = `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(
    term,
  )}&locale=${encodeURIComponent(locale)}&types[]=airport&types[]=city`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `Travelpayouts places autocomplete failed: HTTP ${res.status}`,
    );
  }

  return (await res.json()) as TravelpayoutsPlace[];
}

// ─── Aviasales Flight Search API (v1 / Live) ──────────────────────────────────

export interface AviasalesSearchParams {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null | undefined; // YYYY-MM-DD
  adults: number;
  children?: number | undefined;
  infants?: number | undefined;
  cabinClass?: "economy" | "premium_economy" | "business" | "first" | "premium" | undefined;
  currency?: string | undefined;
  userIp?: string | undefined;
  locale?: string | undefined;
  marketCode?: string | undefined;
}

export interface AviasalesGate {
  id: number;
  label: string;
  currency: string;
  payment_methods?: string[] | undefined;
  type?: string | undefined;
}

export interface AviasalesFlightResult {
  search_id: string;
  proposals?: any[] | undefined;
  gates_info?: Record<string, AviasalesGate> | undefined;
  airlines?: Record<string, { name: string }> | undefined;
  airports?: Record<string, { name: string; city_code?: string }> | undefined;
}

/**
 * Initiates flight search with Aviasales Search API.
 * Returns the search_id (uuid) used to poll for search results.
 */
export async function initAviasalesFlightSearch(
  params: AviasalesSearchParams,
): Promise<string> {
  const token = TRAVELPAYOUTS_TOKEN;
  const marker = TRAVELPAYOUTS_MARKER;

  if (!token || !marker) {
    throw new Error(
      "Travelpayouts credentials missing. Please configure TRAVELPAYOUTS_TOKEN and TRAVELPAYOUTS_MARKER.",
    );
  }

  const tripClass =
    params.cabinClass === "business" || params.cabinClass === "first"
      ? "C"
      : "Y";
  const currency = params.currency || "USD";
  const locale = params.locale || "en";
  const marketCode = params.marketCode || "us";
  const userIp = params.userIp || "127.0.0.1";

  const signature = generateAviasalesSignature(token, marker, {
    currency_code: currency,
    locale,
    market_code: marketCode,
    origin: params.origin,
    destination: params.destination,
    date: params.departureDate,
    return_date: params.returnDate || undefined,
    adults: params.adults,
    children: params.children || 0,
    infants: params.infants || 0,
    trip_class: tripClass,
  });

  const segments: { origin: string; destination: string; date: string }[] = [
    {
      origin: params.origin,
      destination: params.destination,
      date: params.departureDate,
    },
  ];

  if (params.returnDate) {
    segments.push({
      origin: params.destination,
      destination: params.origin,
      date: params.returnDate,
    });
  }

  const requestBody = {
    signature,
    marker,
    host: "beta.aviasales.com",
    user_ip: userIp,
    locale,
    trip_class: tripClass,
    currency,
    passengers: {
      adults: params.adults,
      children: params.children || 0,
      infants: params.infants || 0,
    },
    segments,
  };

  const response = await fetch(
    "https://api.travelpayouts.com/v1/flight_search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-affiliate-user-id": token,
        "x-signature": signature,
        "x-user-ip": userIp,
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Travelpayouts search initiation failed (HTTP ${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as { search_id?: string; uuid?: string };
  const searchId = data.search_id || data.uuid;
  if (!searchId) {
    throw new Error("Travelpayouts API returned no search_id.");
  }

  return searchId;
}

/**
 * Polls search results for a given search_id from Aviasales Search API.
 */
export async function pollAviasalesFlightResults(
  searchId: string,
): Promise<any[]> {
  const url = `https://api.travelpayouts.com/v1/flight_search_results?uuid=${encodeURIComponent(
    searchId,
  )}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "x-affiliate-user-id": TRAVELPAYOUTS_TOKEN,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Travelpayouts polling failed (HTTP ${response.status}): ${err}`,
    );
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

/**
 * Generates an Aviasales affiliate deep link for a specific route search.
 */
export function buildAviasalesSearchLink(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  adults: number;
  cabinClass?: string | undefined;
  marker?: string | undefined;
}): string {
  const marker = params.marker || TRAVELPAYOUTS_MARKER || "778298";
  const [dYear, dMonth, dDay] = params.departureDate.split("-");
  const departPart = `${dDay}${dMonth}`;
  let returnPart = "";
  if (params.returnDate) {
    const [rYear, rMonth, rDay] = params.returnDate.split("-");
    returnPart = `${rDay}${rMonth}`;
  }
  const cabinCode =
    params.cabinClass === "business" || params.cabinClass === "first"
      ? "c"
      : "y";
  const searchPath = `${params.origin.toUpperCase()}${departPart}${params.destination.toUpperCase()}${returnPart}${params.adults}${cabinCode}`;

  return `https://www.aviasales.com/search/${searchPath}?marker=${encodeURIComponent(marker)}`;
}
