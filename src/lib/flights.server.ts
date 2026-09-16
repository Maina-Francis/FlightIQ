/**
 * flights.server.ts
 * Server-only live flight search engine via Duffel API SDK (@duffel/api),
 * price drop computation with Supabase admin client, and Skyscanner deep-linking.
 */

import { duffel } from "./duffel";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildSkyscannerDeepLink } from "./affiliate";
import { getCurrency } from "./currency";
import {
  parseIsoDuration,
  formatIsoTime,
  type FlightOffer,
  type SearchLiveFlightsParams,
} from "./flights";

// ─── Price Drop Detection via Supabase Cache ──────────────────────────────────

async function computePriceDrops(
  offers: { priceUsd: number; origin: string; destination: string }[],
  departureDate: string,
): Promise<Map<string, number>> {
  const dropMap = new Map<string, number>();
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
    return dropMap;
  }

  try {
    const routeKeys = [
      ...new Set(
        offers.map((o) => `${o.origin}-${o.destination}-${departureDate}`),
      ),
    ];

    const { data: cached } = await supabaseAdmin
      .from("flight_price_cache")
      .select("route_key, cheapest_price")
      .in("route_key", routeKeys);

    const cachedMap = new Map(
      (cached ?? []).map((r) => [r.route_key, r.cheapest_price]),
    );

    const currentCheapest = new Map<string, number>();
    for (const offer of offers) {
      const key = `${offer.origin}-${offer.destination}-${departureDate}`;
      const existing = currentCheapest.get(key) ?? Infinity;
      if (offer.priceUsd < existing) currentCheapest.set(key, offer.priceUsd);
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
        const drop = Math.round(
          ((cachedPrice - currentPrice) / cachedPrice) * 100,
        );
        if (drop >= 3) dropMap.set(key, drop);
      }

      upserts.push({
        route_key: key,
        cheapest_price: currentPrice,
        currency: "USD",
        skyscanner_link: `https://www.skyscanner.net/transport/flights/${key}/`,
        updated_at: new Date().toISOString(),
      });
    }

    supabaseAdmin
      .from("flight_price_cache")
      .upsert(upserts, { onConflict: "route_key" })
      .then(({ error }) => {
        if (error)
          console.error("[FlightIQ] Cache upsert failed:", error.message);
      });
  } catch (err) {
    console.warn("[FlightIQ] Price drop detection failed:", err);
  }

  return dropMap;
}

// ─── Offer Normalization & Skyscanner Affiliate Link Attachment ───────────────

/**
 * Converts raw Duffel offers into FlightIQ's FlightOffer interface.
 * Discards Duffel's booking/checkout flows and attaches a direct Skyscanner deep link.
 */
export function normalizeDuffelOffers(
  offers: any[],
  params: SearchLiveFlightsParams,
): FlightOffer[] {
  if (!offers || !Array.isArray(offers)) return [];

  const requestedCurrency = params.currency ?? "USD";
  const mediaPartnerId =
    (typeof process !== "undefined"
      ? process.env?.["VITE_SKYSCANNER_PARTNER_ID"]
      : undefined) ??
    (typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_SKYSCANNER_PARTNER_ID"] as string | undefined)
      : undefined);

  // Exclude Duffel Airways (Duffel's synthetic sandbox airline, IATA code "ZZ")
  const realOffers = offers.filter((offer) => {
    const ownerName = offer.owner?.name?.toLowerCase() ?? "";
    const ownerCode = offer.owner?.iata_code?.toUpperCase() ?? "";
    const outboundSlice = offer.slices?.[0];
    const firstSegment = outboundSlice?.segments?.[0];
    const carrierName = (
      offer.owner?.name ??
      firstSegment?.marketing_carrier?.name ??
      firstSegment?.operating_carrier?.name ??
      ""
    ).toLowerCase();
    const carrierCode = (
      offer.owner?.iata_code ??
      firstSegment?.marketing_carrier?.iata_code ??
      firstSegment?.operating_carrier?.iata_code ??
      ""
    ).toUpperCase();

    if (
      carrierCode === "ZZ" ||
      ownerCode === "ZZ" ||
      carrierName.includes("duffel") ||
      ownerName.includes("duffel")
    ) {
      return false;
    }
    return true;
  });

  const normalized: FlightOffer[] = realOffers.map((offer, idx) => {
    const outboundSlice = offer.slices?.[0];
    const segments = outboundSlice?.segments ?? [];
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];

    // Airline metadata
    const carrierName =
      offer.owner?.name ??
      firstSegment?.marketing_carrier?.name ??
      firstSegment?.operating_carrier?.name ??
      "Unknown Airline";
    const carrierCode =
      offer.owner?.iata_code ??
      firstSegment?.marketing_carrier?.iata_code ??
      firstSegment?.operating_carrier?.iata_code ??
      "??";
    const carrierLogo =
      offer.owner?.logo_symbol_url ??
      firstSegment?.marketing_carrier?.logo_symbol_url ??
      null;

    // Price conversion: Duffel returns total_amount as decimal string with total_currency
    const totalAmount = parseFloat(offer.total_amount || "0");
    const offerCurrency = offer.total_currency || "USD";
    const currencyRate = getCurrency(offerCurrency).rate || 1;
    const priceUsd =
      offerCurrency.toUpperCase() === "USD"
        ? Math.round(totalAmount)
        : Math.round(totalAmount / currencyRate);

    // Schedule & Duration
    const departTime = formatIsoTime(firstSegment?.departing_at);
    const arriveTime = formatIsoTime(lastSegment?.arriving_at);

    let durationMinutes = parseIsoDuration(outboundSlice?.duration);
    if (durationMinutes === 0 && firstSegment?.departing_at && lastSegment?.arriving_at) {
      const diffMs =
        new Date(lastSegment.arriving_at).getTime() -
        new Date(firstSegment.departing_at).getTime();
      durationMinutes = Math.max(0, Math.round(diffMs / 60000));
    }

    const stops = Math.max(0, segments.length - 1);
    const departingAt = firstSegment?.departing_at;

    const offerSkyscannerLink = buildSkyscannerDeepLink({
      origin: params.originIata,
      destination: params.destinationIata,
      departureDate: params.departureDate,
      returnDate: params.returnDate ?? undefined,
      adults: params.adults,
      cabinClass: params.cabinClass,
      currency: requestedCurrency,
      mediaPartnerId,
      carrierCode: carrierCode !== "??" ? carrierCode : undefined,
      stops,
      departureTime: departingAt || departTime,
    });

    return {
      id: offer.id ?? `duffel-${idx}`,
      airline: carrierName,
      airlineCode: carrierCode,
      airlineLogo: carrierLogo,
      priceUsd,
      baselineUsd: priceUsd,
      dropPercent: 0,
      departTime,
      arriveTime,
      departingAt,
      durationMinutes,
      stops,
      origin: params.originIata,
      destination: params.destinationIata,
      bestLocalFare: false,
      skyscanner_link: offerSkyscannerLink,
      deepLink: offerSkyscannerLink,
      rawOffer: offer,
    };
  });

  return normalized;
}

// ─── Live Flight Search Engine (Duffel API) ───────────────────────────────────

/**
 * Searches live flight offers using the official Duffel API SDK (@duffel/api).
 *
 * Slices and passengers are mapped to Duffel's schema, offers are retrieved,
 * normalized into FlightOffer[], and augmented with Skyscanner deep links.
 */
export async function searchLiveFlights(
  params: SearchLiveFlightsParams,
): Promise<FlightOffer[]> {
  const duffelCabin =
    params.cabinClass === "premium" ? "premium_economy" : params.cabinClass;

  const slices = [
    {
      origin: params.originIata,
      destination: params.destinationIata,
      departure_date: params.departureDate,
    },
  ];

  if (params.returnDate) {
    slices.push({
      origin: params.destinationIata,
      destination: params.originIata,
      departure_date: params.returnDate,
    });
  }

  const offerRequest = await duffel.offerRequests.create({
    slices,
    passengers: Array(params.adults).fill({ type: "adult" }),
    cabin_class: duffelCabin,
    return_offers: true,
  });

  const offers = offerRequest.data?.offers ?? [];
  const normalized = normalizeDuffelOffers(offers, params);

  // Price drop detection & Best Local Fare marking
  const dropMap = await computePriceDrops(normalized, params.departureDate);

  for (const offer of normalized) {
    const key = `${offer.origin}-${offer.destination}-${params.departureDate}`;
    const drop = dropMap.get(key) ?? 0;
    offer.dropPercent = drop;
    if (drop > 0) {
      offer.baselineUsd = Math.round(offer.priceUsd / (1 - drop / 100));
    }
  }

  normalized.sort((a, b) => a.priceUsd - b.priceUsd);
  if (normalized[0]) {
    normalized[0].bestLocalFare = true;
  }

  return normalized;
}
