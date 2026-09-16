/**
 * flights.server.ts
 * Server-only live flight search engine via Travelpayouts (Aviasales Flight Search API),
 * multi-provider pricing (OTAs & Airline Direct), price drop computation with Supabase cache,
 * and pre-monetized affiliate deep linking.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildSkyscannerDeepLink } from "./affiliate";
import { getCurrency } from "./currency";
import {
  type FlightOffer,
  type FlightBookingOption,
  type SearchLiveFlightsParams,
} from "./flights";
import {
  initAviasalesFlightSearch,
  pollAviasalesFlightResults,
  buildAviasalesSearchLink,
} from "./travelpayouts";

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

    const { data: cached } = await (supabaseAdmin as any)
      .from("flight_price_cache")
      .select("route_key, cheapest_price")
      .in("route_key", routeKeys);

    const cachedMap = new Map<string, number>(
      (cached ?? []).map((r: any) => [r.route_key, r.cheapest_price]),
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

// ─── Aviasales Proposal Normalization ─────────────────────────────────────────

export function normalizeAviasalesResponse(
  rawResults: any[],
  params: SearchLiveFlightsParams,
  searchId: string,
): FlightOffer[] {
  const allOffers: FlightOffer[] = [];

  for (const chunk of rawResults) {
    const proposals = chunk.proposals ?? [];
    const gatesInfo = chunk.gates_info ?? {};
    const airlinesMap = chunk.airlines ?? {};

    for (let idx = 0; idx < proposals.length; idx++) {
      const proposal = proposals[idx];
      const outboundSegment = proposal.segment?.[0];
      const flights = outboundSegment?.flight ?? [];
      const firstFlight = flights[0];
      const lastFlight = flights[flights.length - 1];

      const carrierCode =
        firstFlight?.operating_carrier ||
        firstFlight?.marketing_carrier ||
        "??";
      const carrierName =
        airlinesMap[carrierCode]?.name ||
        firstFlight?.operating_carrier_name ||
        carrierCode;
      const carrierLogo =
        carrierCode !== "??"
          ? `https://pics.avs.io/al_square/64/64/${carrierCode.toUpperCase()}.png`
          : null;

      const departTime =
        firstFlight?.departure || firstFlight?.departure_time || "--:--";
      const arriveTime =
        lastFlight?.arrival || lastFlight?.arrival_time || "--:--";
      const departingAt = firstFlight?.departure_date
        ? `${firstFlight.departure_date}T${departTime}:00`
        : undefined;

      const durationMinutes =
        outboundSegment?.duration ||
        flights.reduce((acc: number, f: any) => acc + (f.duration || 0), 0) ||
        0;

      const stops = Math.max(0, flights.length - 1);

      // Multi-provider pricing options from gates / OTAs
      const bookingOptions: FlightBookingOption[] = [];
      if (proposal.terms && typeof proposal.terms === "object") {
        for (const [gateId, termData] of Object.entries(proposal.terms) as [
          string,
          any,
        ][]) {
          const gate = gatesInfo[gateId];
          const providerName = gate?.label || `Provider ${gateId}`;
          const termCurrency = (termData.currency || "USD").toUpperCase();
          const rate = getCurrency(termCurrency).rate || 1;
          const termPrice =
            typeof termData.price === "number"
              ? termData.price
              : parseFloat(termData.price || "0");
          const optionPriceUsd =
            termCurrency === "USD"
              ? Math.round(termPrice)
              : Math.round(termPrice / rate);

          const isCarrierDirect = Boolean(
            gate?.type === "airline" ||
              providerName.toLowerCase().includes(carrierName.toLowerCase()) ||
              providerName.toLowerCase().includes(carrierCode.toLowerCase()),
          );

          const clickUrl = termData.url
            ? `https://api.travelpayouts.com/v1/flight_searches/${searchId}/clicks/${termData.url}.json`
            : buildAviasalesSearchLink({
                origin: params.originIata,
                destination: params.destinationIata,
                departureDate: params.departureDate,
                returnDate: params.returnDate ?? undefined,
                adults: params.adults,
                cabinClass: params.cabinClass,
              });

          bookingOptions.push({
            providerId: gateId,
            providerName,
            providerType: isCarrierDirect ? "airline" : "ota",
            priceUsd: optionPriceUsd,
            deepLink: clickUrl,
            isCarrierDirect,
          });
        }
      }

      bookingOptions.sort((a, b) => a.priceUsd - b.priceUsd);
      const cheapestOption = bookingOptions[0];
      if (cheapestOption) {
        cheapestOption.isRecommended = true;
      }

      const totalAmount =
        typeof proposal.total === "number"
          ? proposal.total
          : parseFloat(proposal.total || "0");
      const proposalCurrency = (proposal.currency || "USD").toUpperCase();
      const currRate = getCurrency(proposalCurrency).rate || 1;
      const basePriceUsd =
        proposalCurrency === "USD"
          ? Math.round(totalAmount)
          : Math.round(totalAmount / currRate);

      const lowestPriceUsd = cheapestOption
        ? cheapestOption.priceUsd
        : basePriceUsd;

      const fallbackSearchLink = buildAviasalesSearchLink({
        origin: params.originIata,
        destination: params.destinationIata,
        departureDate: params.departureDate,
        returnDate: params.returnDate ?? undefined,
        adults: params.adults,
        cabinClass: params.cabinClass,
      });

      const offerSkyscannerLink = buildSkyscannerDeepLink({
        origin: params.originIata,
        destination: params.destinationIata,
        departureDate: params.departureDate,
        returnDate: params.returnDate ?? undefined,
        adults: params.adults,
        cabinClass: params.cabinClass,
        currency: params.currency ?? "USD",
        carrierCode: carrierCode !== "??" ? carrierCode : undefined,
        stops,
        departureTime: departingAt || departTime,
      });

      allOffers.push({
        id: proposal.id || `${searchId}-${idx}`,
        airline: carrierName,
        airlineCode: carrierCode,
        airlineLogo: carrierLogo,
        priceUsd: lowestPriceUsd,
        baselineUsd: lowestPriceUsd,
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
        deepLink: cheapestOption ? cheapestOption.deepLink : fallbackSearchLink,
        bookingOptions,
        rawOffer: proposal,
      });
    }
  }

  return allOffers;
}

// ─── Live Flight Search Engine (Travelpayouts API) ─────────────────────────────

/**
 * Searches live flight offers using Travelpayouts (Aviasales Flight Search API).
 * Returns multi-provider flight offers with verified prices and affiliate deep links.
 */
export async function searchLiveFlights(
  params: SearchLiveFlightsParams,
): Promise<FlightOffer[]> {
  const searchId = await initAviasalesFlightSearch({
    origin: params.originIata,
    destination: params.destinationIata,
    departureDate: params.departureDate,
    returnDate: params.returnDate ?? undefined,
    adults: params.adults,
    cabinClass: params.cabinClass,
    currency: params.currency ?? "USD",
  });

  // Poll for results (initial wait + 2 retries if needed)
  let rawResults = await pollAviasalesFlightResults(searchId);

  let attempts = 0;
  while (
    attempts < 3 &&
    (!rawResults ||
      rawResults.length === 0 ||
      !rawResults.some((r) => r.proposals && r.proposals.length > 0))
  ) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    rawResults = await pollAviasalesFlightResults(searchId);
  }

  const normalized = normalizeAviasalesResponse(rawResults, params, searchId);

  // Price drop detection via Supabase cache
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
