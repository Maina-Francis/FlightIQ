/**
 * airports.functions.ts
 * Server functions for live airport search and IATA resolution via Travelpayouts Autocomplete API.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchTravelpayoutsPlaces } from "./travelpayouts";

export type AirportSearchResult = {
  iata: string;
  city: string;
  name: string;
  country: string;
};

const querySchema = z.object({
  query: z.string().max(100),
});

const iataSchema = z.object({
  iata: z.string().min(2).max(4),
});

export const searchAirportsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => querySchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult[]> => {
    const query = data.query.trim();
    const limit = 10;

    if (!query) {
      return [];
    }

    try {
      const places = await searchTravelpayoutsPlaces(query);
      const results: AirportSearchResult[] = [];
      const seen = new Set<string>();

      for (const place of places) {
        if (!place.code) continue;
        const iata = place.code.toUpperCase();
        if (seen.has(iata)) continue;
        seen.add(iata);

        const isCity = place.type === "city";
        const city = isCity
          ? place.name
          : place.city_name || place.name || "";
        const name = isCity ? "All Airports" : place.name || city;
        const country = place.country_name || "";

        results.push({
          iata,
          city,
          name,
          country,
        });

        if (results.length >= limit) break;
      }

      return results;
    } catch (err: any) {
      console.error("[FlightIQ] Travelpayouts places search failed:", err);
      const message =
        err?.message ||
        "Unable to search airports right now. Please try again.";
      throw new Error(message);
    }
  });

export const getAirportByIataFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => iataSchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult | null> => {
    const iata = data.iata.trim().toUpperCase();

    try {
      const places = await searchTravelpayoutsPlaces(iata);
      const match = places.find((p) => p.code?.toUpperCase() === iata);
      if (!match || !match.code) return null;

      const isCity = match.type === "city";
      const city = isCity
        ? match.name
        : match.city_name || match.name || "";
      const name = isCity ? "All Airports" : match.name || city;
      const country = match.country_name || "";

      return {
        iata: match.code.toUpperCase(),
        city,
        name,
        country,
      };
    } catch (err) {
      console.error("[FlightIQ] Failed to resolve airport by IATA:", err);
      return null;
    }
  });
