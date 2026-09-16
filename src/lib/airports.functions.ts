/**
 * airports.functions.ts
 * Server functions for live airport search and IATA resolution via Duffel API.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { duffel, isDuffelConfigured } from "./duffel";

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

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function resolveCountry(countryCode?: string | null, countryName?: string | null): string {
  if (countryName && countryName.trim()) return countryName.trim();
  if (countryCode && countryCode.trim()) {
    try {
      return regionNames.of(countryCode.trim().toUpperCase()) ?? countryCode;
    } catch {
      return countryCode;
    }
  }
  return "";
}

export const searchAirportsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => querySchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult[]> => {
    const query = data.query.trim();
    const limit = 10;

    if (!query) {
      return [];
    }

    if (!isDuffelConfigured()) {
      throw new Error(
        "Duffel API is not configured. Please ensure DUFFEL_API_KEY is configured in your environment.",
      );
    }

    try {
      const response = await duffel.suggestions.list({
        query,
      });

      const places = response.data ?? [];
      const results: AirportSearchResult[] = [];
      const seen = new Set<string>();

      for (const place of places) {
        if (!place.iata_code) continue;
        const iata = place.iata_code.toUpperCase();
        if (seen.has(iata)) continue;
        seen.add(iata);

        const isCity = place.type === "city";
        const city = isCity
          ? place.name
          : place.city_name || place.city?.name || place.name || "";
        const name = isCity ? "All Airports" : place.name || city;
        const country = resolveCountry(
          place.iata_country_code || place.city?.iata_country_code,
          place.country_name,
        );

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
      console.error("[FlightIQ] Duffel suggestions search failed:", err);
      const message =
        err?.errors?.[0]?.message ||
        err?.message ||
        "Unable to search airports right now. Please try again.";
      throw new Error(message);
    }
  });

export const getAirportByIataFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => iataSchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult | null> => {
    const iata = data.iata.trim().toUpperCase();

    if (!isDuffelConfigured()) {
      return null;
    }

    try {
      const response = await duffel.suggestions.list({
        query: iata,
      });

      const places = response.data ?? [];
      const match = places.find((p) => p.iata_code?.toUpperCase() === iata);
      if (!match || !match.iata_code) return null;

      const isCity = match.type === "city";
      const city = isCity
        ? match.name
        : match.city_name || match.city?.name || match.name || "";
      const name = isCity ? "All Airports" : match.name || city;
      const country = resolveCountry(
        match.iata_country_code || match.city?.iata_country_code,
        match.country_name,
      );

      return {
        iata: match.iata_code.toUpperCase(),
        city,
        name,
        country,
      };
    } catch (err) {
      console.error("[FlightIQ] Failed to resolve airport by IATA:", err);
      return null;
    }
  });
