/**
 * flights.server.ts
 * Server-only live flight search engine via Travelpayouts (Aviasales Data API v3),
 * multi-provider pricing, price drop computation with Supabase cache,
 * and pre-monetized affiliate deep linking (marker 778298).
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAirlineName, getAirlineLogoUrl, loadAirlinesDatabase } from "./airlines";
import { buildSkyscannerDeepLink } from "./affiliate";
import {
  formatIsoTime,
  type FlightOffer,
  type FlightBookingOption,
  type SearchLiveFlightsParams,
} from "./flights";
import {
  fetchFlightPrices,
  buildAviasalesOfferUrl,
  buildAviasalesPartnerUrl,
  type AviasalesDataPrice,
} from "./travelpayouts";
import { getProviderMeta } from "./booking-providers";

// --- Price Drop Detection via Supabase Cache ----------------------------------

async function computePriceDrops(
  offers: { price: number; origin: string; destination: string; currency: string }[],
  departureDate: string,
): Promise<Map<string, number>> {
  const dropMap = new Map<string, number>();
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    return dropMap;
  }

  try {
    const routeKeys = [
      ...new Set(offers.map((o) => `${o.origin}-${o.destination}-${departureDate}-${o.currency}`)),
    ];

    const { data: cached } = await (
      supabaseAdmin as unknown as {
        from: (table: string) => {
          select: (cols: string) => {
            in: (
              col: string,
              vals: string[],
            ) => Promise<{
              data?: { route_key: string; cheapest_price: number }[] | null;
            }>;
          };
          upsert: (
            rows: unknown[],
            opts: { onConflict: string },
          ) => Promise<{ error?: { message: string } | null }>;
        };
      }
    )
      .from("flight_price_cache")
      .select("route_key, cheapest_price")
      .in("route_key", routeKeys);

    const cachedMap = new Map<string, number>(
      (cached ?? []).map((r: { route_key: string; cheapest_price: number }) => [
        r.route_key,
        r.cheapest_price,
      ]),
    );

    const currentCheapest = new Map<string, number>();
    for (const offer of offers) {
      const key = `${offer.origin}-${offer.destination}-${departureDate}-${offer.currency}`;
      const existing = currentCheapest.get(key) ?? Infinity;
      if (offer.price < existing) currentCheapest.set(key, offer.price);
    }

    const upserts: {
      route_key: string;
      cheapest_price: number;
      currency: string;
      skyscanner_link: string;
      updated_at: string;
    }[] = [];

    for (const [key, currentPrice] of currentCheapest.entries()) {
      const cachedPrice = cachedMap.get(key);

      if (cachedPrice && cachedPrice > currentPrice) {
        const drop = Math.round(((cachedPrice - currentPrice) / cachedPrice) * 100);
        if (drop >= 3) dropMap.set(key, drop);
      }

      upserts.push({
        route_key: key,
        cheapest_price: currentPrice,
        currency: key.split("-").at(-1) ?? "USD",
        skyscanner_link: `https://www.skyscanner.net/transport/flights/${key}/`,
        updated_at: new Date().toISOString(),
      });
    }

    (
      supabaseAdmin as unknown as {
        from: (table: string) => {
          upsert: (
            rows: unknown[],
            opts: { onConflict: string },
          ) => Promise<{ error?: { message: string } | null }>;
        };
      }
    )
      .from("flight_price_cache")
      .upsert(upserts, { onConflict: "route_key" })
      .then(({ error }: { error?: { message: string } | null }) => {
        if (error && !error.message?.includes("fetch failed")) {
          console.warn("[FlightIQ] Cache upsert notice:", error.message);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("fetch failed")) {
          console.warn("[FlightIQ] Cache upsert notice:", msg);
        }
      });
  } catch (err) {
    console.warn("[FlightIQ] Price drop detection failed:", err);
  }

  return dropMap;
}

// --- Flight Grouping Key ------------------------------------------------------

/**
 * Builds a key that identifies a unique physical flight regardless of which
 * OTA / gate is selling it.  The Aviasales Data API returns one row per gate
 * for the same departure, so we group them to show a single card with all
 * booking options.
 */
function flightGroupKey(item: AviasalesDataPrice): string {
  const depMinute = item.departure_at
    ? item.departure_at.slice(0, 16) // "YYYY-MM-DDTHH:MM"
    : "unknown";
  return `${item.airline}-${depMinute}-${item.flight_number}-${item.transfers}`;
}

// --- Live Flight Search Engine ------------------------------------------------

/**
 * Searches live flight offers using Travelpayouts (Aviasales Data API v3).
 *
 * Key behaviour:
 *  - Groups all gate/OTA variants of the same physical flight into ONE card.
 *  - bookingOptions holds one entry per OTA with its exact API price, giving
 *    users a single source of truth matching what Aviasales shows.
 *  - offer.price is always the cheapest gate price found.
 *  - Each booking option deep-link goes directly to that OTA via affiliate URL.
 */
export async function searchLiveFlights(params: SearchLiveFlightsParams): Promise<FlightOffer[]> {
  const responseCurrency = (params.currency || "USD").toUpperCase();

  const dataPrices = await fetchFlightPrices({
    origin: params.originIata,
    destination: params.destinationIata,
    departureDate: params.departureDate,
    returnDate: params.returnDate ?? undefined,
    currency: responseCurrency.toLowerCase(),
  });

  const partnerSearchUrl = buildAviasalesPartnerUrl({
    origin: params.originIata,
    destination: params.destinationIata,
    departureDate: params.departureDate,
    returnDate: params.returnDate ?? undefined,
    adults: params.adults,
  });

  void loadAirlinesDatabase();

  // Step 1: group all API rows by unique flight
  const groups = new Map<string, AviasalesDataPrice[]>();
  for (const item of dataPrices) {
    const key = flightGroupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  // Step 2: build one FlightOffer per group
  const normalized: FlightOffer[] = [];

  for (const [groupKey, items] of groups.entries()) {
    const rep = items[0]!;
    const carrierCode = (rep.airline || "??").toUpperCase();
    const airlineName = getAirlineName(carrierCode);
    const carrierLogo = carrierCode !== "??" ? getAirlineLogoUrl(carrierCode) : null;

    const departTime = rep.departure_at ? formatIsoTime(rep.departure_at) : "--:--";
    const durationMinutes = rep.duration || 0;

    let arriveTime = "--:--";
    if (rep.departure_at) {
      const depDate = new Date(rep.departure_at);
      if (!isNaN(depDate.getTime())) {
        const arrDate = new Date(depDate.getTime() + durationMinutes * 60_000);
        arriveTime = arrDate.toISOString().split("T")[1]?.slice(0, 5) ?? "--:--";
      }
    }

    const skyscannerLink = buildSkyscannerDeepLink({
      origin: params.originIata,
      destination: params.destinationIata,
      departureDate: params.departureDate,
      returnDate: params.returnDate ?? undefined,
      adults: params.adults,
      cabinClass: params.cabinClass,
      currency: params.currency ?? "USD",
      carrierCode: carrierCode !== "??" ? carrierCode : undefined,
      stops: rep.transfers,
      departureTime: rep.departure_at,
    });

    // Build booking options — one per unique gate, cheapest first
    const seenGates = new Set<string>();
    const bookingOptions: FlightBookingOption[] = [];
    const sortedItems = [...items].sort((a, b) => a.price - b.price);

    for (const gateItem of sortedItems) {
      const gateKey = gateItem.gate ?? `gate-${bookingOptions.length}`;
      if (seenGates.has(gateKey)) continue;
      seenGates.add(gateKey);

      const meta = getProviderMeta(gateItem.gate);
      const gateLink = buildAviasalesOfferUrl(gateItem.link, partnerSearchUrl);

      bookingOptions.push({
        providerId: gateKey,
        providerName: meta.name,
        providerType: meta.isAirlineDirect ? "airline" : "ota",
        price: gateItem.price,
        currency: responseCurrency,
        deepLink: gateLink,
        isCarrierDirect: meta.isAirlineDirect ?? false,
        isRecommended: bookingOptions.length === 0,
      });
    }

    const cheapestPrice = bookingOptions[0]?.price ?? rep.price;
    const cheapestLink =
      bookingOptions[0]?.deepLink ?? buildAviasalesOfferUrl(rep.link, partnerSearchUrl);

    normalized.push({
      id: `avs-${carrierCode}-${groupKey}`,
      airline: airlineName,
      airlineCode: carrierCode,
      airlineLogo: carrierLogo,
      price: cheapestPrice,
      baselinePrice: cheapestPrice,
      currency: responseCurrency,
      dropPercent: 0,
      departTime,
      arriveTime,
      departingAt: rep.departure_at,
      durationMinutes,
      stops: rep.transfers,
      origin: params.originIata,
      destination: params.destinationIata,
      bestLocalFare: false,
      skyscanner_link: skyscannerLink,
      deepLink: cheapestLink,
      bookingOptions,
      rawOffer: rep,
    });
  }

  // Price drop detection
  const dropMap = await computePriceDrops(normalized, params.departureDate);
  for (const offer of normalized) {
    const key = `${offer.origin}-${offer.destination}-${params.departureDate}-${offer.currency}`;

    const drop = dropMap.get(key) ?? 0;
    offer.dropPercent = drop;
    if (drop > 0) {
      offer.baselinePrice = Math.round(offer.price / (1 - drop / 100));
    }
  }

  normalized.sort((a, b) => a.price - b.price);
  if (normalized[0]) {
    normalized[0].bestLocalFare = true;
  }

  return normalized;
}
