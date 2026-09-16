/**
 * flights.server.ts
 * Server-only live flight search engine via Travelpayouts (Aviasales Data API v3),
 * multi-provider pricing, price drop computation with Supabase cache,
 * and pre-monetized affiliate deep linking (marker 778298).
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
} from "./travelpayouts";

// ─── Price Drop Detection via Supabase Cache ──────────────────────────────────

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
      ...new Set(
        offers.map((o) => `${o.origin}-${o.destination}-${departureDate}-${o.currency}`),
      ),
    ];

    const { data: cached } = await (supabaseAdmin as any)
      .from("flight_price_cache")
      .select("route_key, cheapest_price")
      .in("route_key", routeKeys);

    const cachedMap = new Map<string, number>(
      (cached ?? []).map((r: any) => [r.route_key, r.cheapest_price]),
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
        const drop = Math.round(
          ((cachedPrice - currentPrice) / cachedPrice) * 100,
        );
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

    (supabaseAdmin as any)
      .from("flight_price_cache")
      .upsert(upserts, { onConflict: "route_key" })
      .then(({ error }: any) => {
        if (error)
          console.error("[FlightIQ] Cache upsert failed:", error.message);
      });
  } catch (err) {
    console.warn("[FlightIQ] Price drop detection failed:", err);
  }

  return dropMap;
}

// ─── Live Flight Search Engine (Aviasales Data API v3) ─────────────────────────

/**
 * Searches live flight offers using Travelpayouts (Aviasales Data API v3).
 * Returns multi-provider flight offers with verified prices and affiliate deep links.
 */
export async function searchLiveFlights(
  params: SearchLiveFlightsParams,
): Promise<FlightOffer[]> {
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

  const normalized: FlightOffer[] = dataPrices.map((item, idx) => {
    const carrierCode = item.airline || "??";
    const carrierLogo =
      carrierCode !== "??"
        ? `https://pics.avs.io/al_square/64/64/${carrierCode.toUpperCase()}.png`
        : null;

    const departTime = item.departure_at
      ? formatIsoTime(item.departure_at)
      : "--:--";
    const durationMinutes = item.duration || 0;

    let arriveTime = "--:--";
    if (item.departure_at) {
      const depDate = new Date(item.departure_at);
      if (!isNaN(depDate.getTime())) {
        const arrDate = new Date(depDate.getTime() + durationMinutes * 60000);
        arriveTime = arrDate.toISOString().split("T")[1]?.slice(0, 5) ?? "--:--";
      }
    }

    const itemLink = buildAviasalesOfferUrl(item.link, partnerSearchUrl);

    const skyscannerLink = buildSkyscannerDeepLink({
      origin: params.originIata,
      destination: params.destinationIata,
      departureDate: params.departureDate,
      returnDate: params.returnDate ?? undefined,
      adults: params.adults,
      cabinClass: params.cabinClass,
      currency: params.currency ?? "USD",
      carrierCode: carrierCode !== "??" ? carrierCode : undefined,
      stops: item.transfers,
      departureTime: item.departure_at,
    });

    const bookingOptions: FlightBookingOption[] = [
      {
        providerId: item.gate || `gate-${idx}`,
        providerName: item.gate || "Aviasales / OTAs",
        providerType: "ota",
        price: item.price,
        currency: responseCurrency,
        deepLink: itemLink,
        isRecommended: true,
      },
    ];

    return {
      id: `avs-${carrierCode}-${item.flight_number || idx}`,
      airline: carrierCode,
      airlineCode: carrierCode,
      airlineLogo: carrierLogo,
      price: item.price,
      baselinePrice: item.price,
      currency: responseCurrency,
      dropPercent: 0,
      departTime,
      arriveTime,
      departingAt: item.departure_at,
      durationMinutes,
      stops: item.transfers,
      origin: params.originIata,
      destination: params.destinationIata,
      bestLocalFare: false,
      skyscanner_link: skyscannerLink,
      deepLink: itemLink,
      bookingOptions,
      rawOffer: item,
    };
  });

  // Price drop detection via Supabase cache
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
