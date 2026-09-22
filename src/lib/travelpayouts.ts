/**
 * travelpayouts.ts
 * Travelpayouts (Aviasales Data API v3 & Autocomplete client).
 *
 * Fetches flight fares via Aviasales Data API v3 (/v3/prices_for_dates)
 * and constructs direct partner deep links monetized under marker 778298.
 */

import crypto from "crypto";

export const TRAVELPAYOUTS_TOKEN: string =
  process.env["TRAVELPAYOUTS_TOKEN"] ?? "b41a17f0393abfee3a24e26b65a2148f";
export const TRAVELPAYOUTS_MARKER: string =
  process.env["TRAVELPAYOUTS_MARKER"] ?? "778298";

export function isTravelpayoutsConfigured(): boolean {
  return Boolean(TRAVELPAYOUTS_TOKEN && TRAVELPAYOUTS_MARKER);
}

// ─── Aviasales Data API v3 ───────────────────────────────────────────────────

export interface DataApiPriceParams {
  origin: string; // IATA code, e.g. "CPT"
  destination: string; // IATA code, e.g. "LON"
  departureDate: string; // YYYY-MM-DD or YYYY-MM
  returnDate?: string | undefined; // YYYY-MM-DD or YYYY-MM
  currency?: string | undefined; // Default "usd"
  direct?: boolean | undefined;
}

export interface AviasalesDataPrice {
  origin: string;
  destination: string;
  departure_at: string;
  return_at?: string | undefined;
  price: number;
  airline: string;
  flight_number: number | string;
  transfers: number;
  duration: number;
  link: string;
  origin_airport?: string | undefined;
  destination_airport?: string | undefined;
  gate?: string | undefined;
  duration_to?: number | undefined;
  duration_back?: number | undefined;
}

/**
 * Fetch flight fares using Aviasales Data API v3 (/aviasales/v3/prices_for_dates).
 * Returns an empty array (instead of throwing) when the route is uncached,
 * the API is unreachable, or a network timeout occurs — allowing the UI to
 * gracefully display the "No live flights found" state.
 */
export async function fetchFlightPrices(
  params: DataApiPriceParams,
): Promise<AviasalesDataPrice[]> {
  const url = new URL(
    "https://api.travelpayouts.com/aviasales/v3/prices_for_dates",
  );

  url.searchParams.append("origin", params.origin.toUpperCase());
  url.searchParams.append("destination", params.destination.toUpperCase());
  url.searchParams.append("departure_at", params.departureDate);
  if (params.returnDate) {
    url.searchParams.append("return_at", params.returnDate);
  }
  url.searchParams.append("currency", params.currency || "usd");
  url.searchParams.append("direct", params.direct ? "true" : "false");
  url.searchParams.append("unique", "false");
  url.searchParams.append("sorting", "price");
  url.searchParams.append("limit", "30");
  url.searchParams.append("token", TRAVELPAYOUTS_TOKEN);

  // Abort the request if it takes longer than 12 seconds
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (networkErr) {
    // Network-level failures (timeout, DNS, unreachable host) — return empty
    // so the UI shows "No live flights found" instead of crashing.
    const reason =
      networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.warn(
      `[FlightIQ] Aviasales Data API unreachable (${params.origin}→${params.destination}): ${reason}`,
    );
    return [];
  } finally {
    clearTimeout(timeoutId);
  }

  // Non-2xx HTTP responses (e.g. 403 Access Denied, 429 Rate Limit)
  if (!response.ok) {
    console.warn(
      `[FlightIQ] Aviasales Data API returned HTTP ${response.status} for ${params.origin}→${params.destination}`,
    );
    return [];
  }

  let result: { success?: boolean; data?: AviasalesDataPrice[]; error?: string };
  try {
    result = (await response.json()) as typeof result;
  } catch {
    console.warn("[FlightIQ] Aviasales Data API returned non-JSON body");
    return [];
  }

  // The API returns success:false with data:null for uncached routes
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    if (result.error) {
      console.warn(`[FlightIQ] Aviasales Data API error: ${result.error}`);
    }
    return [];
  }

  return result.data;
}

/**
 * Build partner deep link for search redirect
 */
export function buildAviasalesPartnerUrl(params: {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate?: string | null | undefined; // YYYY-MM-DD
  adults?: number | undefined;
}): string {
  // Format DDMM (e.g., 2026-09-23 -> 2309)
  const formatDDMM = (dStr: string) => {
    const parts = dStr.split("-");
    if (parts.length >= 3) {
      const [, month, day] = parts;
      return `${day}${month}`;
    }
    return dStr.replace(/-/g, "");
  };

  const dep = formatDDMM(params.departureDate);
  const ret = params.returnDate ? formatDDMM(params.returnDate) : "";
  const adults = params.adults || 1;

  // Aviasales Search URL format: /search/{ORIGIN}{DEP_DDMM}{DESTINATION}{RET_DDMM}{PASSENGERS}
  const routeSegment = `${params.origin.toUpperCase()}${dep}${params.destination.toUpperCase()}${ret}${adults}`;
  return `https://www.aviasales.com/search/${routeSegment}?marker=${TRAVELPAYOUTS_MARKER}`;
}

export const buildAviasalesSearchLink = buildAviasalesPartnerUrl;

export function buildAviasalesOfferUrl(link: string | null | undefined, fallbackUrl: string): string {
  if (!link) return fallbackUrl;
  const baseUrl = link.startsWith("http") ? link : `https://www.aviasales.com${link}`;
  const separator = baseUrl.includes("?") ? "&" : "?";
  return baseUrl.includes("marker=")
    ? baseUrl
    : `${baseUrl}${separator}marker=${TRAVELPAYOUTS_MARKER}`;
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
 * Generates an MD5 signature for Aviasales API requests.
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

// ─── Fallback / Compatibility Search Methods ─────────────────────────────────

export interface AviasalesSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  adults: number;
  children?: number | undefined;
  infants?: number | undefined;
  cabinClass?: "economy" | "premium_economy" | "business" | "first" | "premium" | undefined;
  currency?: string | undefined;
  userIp?: string | undefined;
  locale?: string | undefined;
  marketCode?: string | undefined;
}

export async function startFlightSearch(
  params: AviasalesSearchParams,
): Promise<{ search_id: string; results_url: string }> {
  const signature = generateAviasalesSignature(
    TRAVELPAYOUTS_TOKEN,
    TRAVELPAYOUTS_MARKER,
    {
      currency_code: params.currency || "USD",
      locale: params.locale || "en",
      market_code: params.marketCode || "us",
      origin: params.origin,
      destination: params.destination,
      date: params.departureDate,
      return_date: params.returnDate || undefined,
      adults: params.adults,
      children: params.children || 0,
      infants: params.infants || 0,
      trip_class: params.cabinClass === "business" ? "C" : "Y",
    },
  );

  const routeSegment = `${params.origin}${params.departureDate.replace(/-/g, "")}${params.destination}`;
  const resultsUrl = `https://www.aviasales.com/search/${routeSegment}?marker=${TRAVELPAYOUTS_MARKER}`;
  const searchId = `avs-${signature.slice(0, 16)}`;

  return { search_id: searchId, results_url: resultsUrl };
}

export const initAviasalesFlightSearch = async (
  params: AviasalesSearchParams,
): Promise<string> => {
  const res = await startFlightSearch(params);
  return res.search_id;
};

export async function pollFlightResults(searchId: string): Promise<any[]> {
  return [];
}

export const pollAviasalesFlightResults = pollFlightResults;
