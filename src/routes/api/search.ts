import { createAPIFileRoute } from "@tanstack/react-start/api";
import { buildSkyscannerDeepLink, getAirlineWebsite } from "@/lib/affiliate";
import {
  buildAviasalesOfferUrl,
  buildAviasalesPartnerUrl,
  fetchFlightPrices,
} from "@/lib/travelpayouts";
import { formatIsoTime } from "@/lib/flights";
import type { FlightDeal, FlightProvider } from "@/types/flight";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const APIRoute = createAPIFileRoute("/api/search")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const origin = url.searchParams.get("origin")?.trim().toUpperCase();
    const destination = url.searchParams.get("destination")?.trim().toUpperCase();
    const departureDate = url.searchParams.get("departureDate")?.trim();
    const returnDate = url.searchParams.get("returnDate")?.trim() || undefined;
    const currency = (url.searchParams.get("currency") || "USD").trim().toUpperCase();
    const adults = parsePositiveInt(url.searchParams.get("adults"), 1);
    const cabinClass = url.searchParams.get("cabin") || "economy";

    if (!origin || !destination || !departureDate) {
      return jsonResponse(
        {
          error:
            "Missing required query parameters. Provide origin, destination, and departureDate.",
        },
        { status: 400 },
      );
    }

    try {
      const prices = await fetchFlightPrices({
        origin,
        destination,
        departureDate,
        returnDate,
        currency: currency.toLowerCase(),
      });

      const partnerSearchUrl = buildAviasalesPartnerUrl({
        origin,
        destination,
        departureDate,
        returnDate,
        adults,
      });

      const deals: FlightDeal[] = prices.map((item, index) => {
        const carrierCode = (item.airline || "??").toUpperCase();
        const primaryUrl = buildAviasalesOfferUrl(item.link, partnerSearchUrl);
        const departureTime = item.departure_at ? formatIsoTime(item.departure_at) : "--:--";
        const durationMinutes = item.duration || 0;
        let arrivalTime = "--:--";

        if (item.departure_at) {
          const depDate = new Date(item.departure_at);
          if (!isNaN(depDate.getTime())) {
            arrivalTime =
              new Date(depDate.getTime() + durationMinutes * 60000)
                .toISOString()
                .split("T")[1]
                ?.slice(0, 5) ?? "--:--";
          }
        }

        const skyscannerUrl = buildSkyscannerDeepLink({
          origin,
          destination,
          departureDate,
          returnDate,
          adults,
          cabinClass,
          currency,
          carrierCode: carrierCode !== "??" ? carrierCode : undefined,
          stops: item.transfers,
          departureTime: item.departure_at,
        });

        const providers: FlightProvider[] = [
          {
            id: item.gate || "aviasales",
            name: item.gate || "Aviasales Metasearch",
            price: item.price,
            currency,
            bookingUrl: primaryUrl,
          },
          {
            id: "airline-direct",
            name: `${carrierCode} Airline Direct`,
            price: item.price,
            currency,
            bookingUrl: getAirlineWebsite(carrierCode),
          },
          {
            id: "skyscanner",
            name: "Skyscanner",
            price: item.price,
            currency,
            bookingUrl: skyscannerUrl,
          },
        ];

        return {
          id: `avs-${carrierCode}-${item.flight_number || index}`,
          origin,
          destination,
          departureTime,
          arrivalTime,
          durationMinutes,
          stops: item.transfers,
          carrierName: carrierCode,
          carrierCode,
          cheapestPrice: item.price,
          currency,
          bookingUrl: primaryUrl,
          providers,
        };
      });

      return jsonResponse({ deals });
    } catch (err) {
      console.error("[FlightIQ] /api/search failed:", err);
      return jsonResponse(
        {
          error:
            err instanceof Error ? err.message : "Unable to retrieve flight deals.",
        },
        { status: 502 },
      );
    }
  },
});
