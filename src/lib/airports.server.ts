/**
 * airports.server.ts
 * Server-side airport search via Duffel API with local fallback.
 * Queries the Duffel airports endpoint for live, comprehensive results.
 * Falls back to the hardcoded list if the API is unavailable.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { duffel, isDuffelConfigured } from "./duffel";
import { AIRPORTS, type Airport } from "./airports";

export type AirportSearchResult = {
  iata: string;
  city: string;
  name: string;
  country: string;
};

const querySchema = z.object({
  query: z.string().max(100),
});

function searchLocal(query: string, limit: number): AirportSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.slice(0, limit);
  return AIRPORTS.filter(
    (a) =>
      a.iata.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q),
  )
    .slice(0, limit)
    .map((a) => ({ iata: a.iata, city: a.city, name: a.name, country: a.country }));
}

export const searchAirportsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => querySchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult[]> => {
    const query = data.query.trim();
    const limit = 8;

    if (!isDuffelConfigured()) {
      return searchLocal(query, limit);
    }

    try {
      const response = await duffel.airports.list({
        ...(query ? { iata_code: query.toUpperCase() } : {}),
        limit,
      });

      const airports = response.data ?? [];

      if (airports.length === 0 && query) {
        return searchLocal(query, limit);
      }

      return airports.map((a: any) => ({
        iata: a.iata_code ?? "",
        city: a.city?.name ?? a.city_name ?? "",
        name: a.name ?? a.city?.name ?? "",
        country: a.city?.iata_country_code ?? a.country_name ?? "",
      }));
    } catch (err) {
      console.error("[FlightIQ] Duffel airport search failed:", err);
      return searchLocal(query, limit);
    }
  });
