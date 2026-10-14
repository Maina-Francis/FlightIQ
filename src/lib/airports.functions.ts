/**
 * airports.functions.ts
 * Server functions for live airport search and IATA resolution via Travelpayouts Autocomplete API.
 *
 * Ensures full distinction between physical airports (e.g. Jomo Kenyatta International NBO vs Wilson WIL)
 * and city groups (e.g. Nairobi All Airports), with country-level intelligent airport routing.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchTravelpayoutsPlaces } from "./travelpayouts";

export type AirportSearchResult = {
  iata: string;
  city: string;
  name: string;
  country: string;
  type?: "airport" | "city";
};

const querySchema = z.object({
  query: z.string().max(100),
});

const iataSchema = z.object({
  iata: z.string().min(2).max(4),
});

// Major gateway airports per country to ensure accurate suggestions when users type country names
const COUNTRY_MAJOR_HUBS: Record<string, AirportSearchResult[]> = {
  kenya: [
    {
      iata: "NBO",
      city: "Nairobi",
      name: "Jomo Kenyatta International Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "MBA",
      city: "Mombasa",
      name: "Moi International Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "KIS",
      city: "Kisumu",
      name: "Kisumu International Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "EDL",
      city: "Eldoret",
      name: "Eldoret International Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "WIL",
      city: "Nairobi",
      name: "Wilson Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "UKA",
      city: "Ukunda",
      name: "Ukunda / Diani Airport",
      country: "Kenya",
      type: "airport",
    },
    {
      iata: "MYD",
      city: "Malindi",
      name: "Malindi Airport",
      country: "Kenya",
      type: "airport",
    },
  ],
  tanzania: [
    {
      iata: "DAR",
      city: "Dar es Salaam",
      name: "Julius Nyerere International Airport",
      country: "Tanzania",
      type: "airport",
    },
    {
      iata: "ZNZ",
      city: "Zanzibar",
      name: "Abeid Amani Karume International Airport",
      country: "Tanzania",
      type: "airport",
    },
    {
      iata: "JRO",
      city: "Kilimanjaro",
      name: "Kilimanjaro International Airport",
      country: "Tanzania",
      type: "airport",
    },
  ],
  uganda: [
    {
      iata: "EBB",
      city: "Entebbe",
      name: "Entebbe International Airport",
      country: "Uganda",
      type: "airport",
    },
  ],
  rwanda: [
    {
      iata: "KGL",
      city: "Kigali",
      name: "Kigali International Airport",
      country: "Rwanda",
      type: "airport",
    },
  ],
  "south africa": [
    {
      iata: "JNB",
      city: "Johannesburg",
      name: "O.R. Tambo International Airport",
      country: "South Africa",
      type: "airport",
    },
    {
      iata: "CPT",
      city: "Cape Town",
      name: "Cape Town International Airport",
      country: "South Africa",
      type: "airport",
    },
    {
      iata: "DUR",
      city: "Durban",
      name: "King Shaka International Airport",
      country: "South Africa",
      type: "airport",
    },
  ],
  nigeria: [
    {
      iata: "LOS",
      city: "Lagos",
      name: "Murtala Muhammed International Airport",
      country: "Nigeria",
      type: "airport",
    },
    {
      iata: "ABV",
      city: "Abuja",
      name: "Nnamdi Azikiwe International Airport",
      country: "Nigeria",
      type: "airport",
    },
  ],
  egypt: [
    {
      iata: "CAI",
      city: "Cairo",
      name: "Cairo International Airport",
      country: "Egypt",
      type: "airport",
    },
    {
      iata: "HRG",
      city: "Hurghada",
      name: "Hurghada International Airport",
      country: "Egypt",
      type: "airport",
    },
  ],
  uae: [
    {
      iata: "DXB",
      city: "Dubai",
      name: "Dubai International Airport",
      country: "United Arab Emirates",
      type: "airport",
    },
    {
      iata: "AUH",
      city: "Abu Dhabi",
      name: "Zayed International Airport",
      country: "United Arab Emirates",
      type: "airport",
    },
    {
      iata: "SHJ",
      city: "Sharjah",
      name: "Sharjah International Airport",
      country: "United Arab Emirates",
      type: "airport",
    },
  ],
  "united arab emirates": [
    {
      iata: "DXB",
      city: "Dubai",
      name: "Dubai International Airport",
      country: "United Arab Emirates",
      type: "airport",
    },
    {
      iata: "AUH",
      city: "Abu Dhabi",
      name: "Zayed International Airport",
      country: "United Arab Emirates",
      type: "airport",
    },
  ],
  uk: [
    {
      iata: "LHR",
      city: "London",
      name: "Heathrow Airport",
      country: "United Kingdom",
      type: "airport",
    },
    {
      iata: "LGW",
      city: "London",
      name: "Gatwick Airport",
      country: "United Kingdom",
      type: "airport",
    },
    {
      iata: "MAN",
      city: "Manchester",
      name: "Manchester Airport",
      country: "United Kingdom",
      type: "airport",
    },
    {
      iata: "EDI",
      city: "Edinburgh",
      name: "Edinburgh Airport",
      country: "United Kingdom",
      type: "airport",
    },
  ],
  "united kingdom": [
    {
      iata: "LHR",
      city: "London",
      name: "Heathrow Airport",
      country: "United Kingdom",
      type: "airport",
    },
    {
      iata: "LGW",
      city: "London",
      name: "Gatwick Airport",
      country: "United Kingdom",
      type: "airport",
    },
    {
      iata: "MAN",
      city: "Manchester",
      name: "Manchester Airport",
      country: "United Kingdom",
      type: "airport",
    },
  ],
  usa: [
    {
      iata: "JFK",
      city: "New York",
      name: "John F. Kennedy International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "LAX",
      city: "Los Angeles",
      name: "Los Angeles International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "ORD",
      city: "Chicago",
      name: "O'Hare International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "MIA",
      city: "Miami",
      name: "Miami International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "ATL",
      city: "Atlanta",
      name: "Hartsfield-Jackson Atlanta International Airport",
      country: "United States",
      type: "airport",
    },
  ],
  "united states": [
    {
      iata: "JFK",
      city: "New York",
      name: "John F. Kennedy International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "LAX",
      city: "Los Angeles",
      name: "Los Angeles International Airport",
      country: "United States",
      type: "airport",
    },
    {
      iata: "ORD",
      city: "Chicago",
      name: "O'Hare International Airport",
      country: "United States",
      type: "airport",
    },
  ],
};

export const searchAirportsFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => querySchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult[]> => {
    const query = data.query.trim();
    const queryLower = query.toLowerCase();
    const limit = 12;

    if (!query) {
      return [];
    }

    try {
      const places = await searchTravelpayoutsPlaces(query);

      const airportMatches: AirportSearchResult[] = [];
      const cityMatches: AirportSearchResult[] = [];
      const seen = new Set<string>();

      // Check if user is searching for a known country name
      const countryHubs = COUNTRY_MAJOR_HUBS[queryLower];
      if (countryHubs) {
        for (const hub of countryHubs) {
          seen.add(`${hub.iata}-${hub.name}`);
          airportMatches.push(hub);
        }
      }

      for (const place of places) {
        if (!place.code) continue;
        const iata = place.code.toUpperCase();
        const isCity = place.type === "city";

        const city = isCity ? place.name : place.city_name || place.name || "";
        const name = isCity ? "All Airports" : place.name || city;
        const country = place.country_name || "";

        // Key on IATA + distinct name so physical airports (e.g. Jomo Kenyatta)
        // are NEVER shadowed or hidden by city aggregates (e.g. Nairobi All Airports)
        const uniqueKey = `${iata}-${name}`;
        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        const resultItem: AirportSearchResult = {
          iata,
          city,
          name,
          country,
          type: isCity ? "city" : "airport",
        };

        if (isCity) {
          cityMatches.push(resultItem);
        } else {
          airportMatches.push(resultItem);
        }
      }

      // Return individual airports first, followed by "All Airports" city groupings
      return [...airportMatches, ...cityMatches].slice(0, limit);
    } catch (err: unknown) {
      console.error("[FlightIQ] Travelpayouts places search failed:", err);
      // Fallback to country hubs if remote search fails
      if (COUNTRY_MAJOR_HUBS[queryLower]) {
        return COUNTRY_MAJOR_HUBS[queryLower]!;
      }
      const message =
        err instanceof Error
          ? err.message
          : "Unable to search airports right now. Please try again.";
      throw new Error(message);
    }
  });

export const getAirportByIataFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => iataSchema.parse(raw))
  .handler(async ({ data }): Promise<AirportSearchResult | null> => {
    const iata = data.iata.trim().toUpperCase();

    try {
      const places = await searchTravelpayoutsPlaces(iata);
      // Prioritize the physical airport entry over city groupings
      const match =
        places.find((p) => p.code?.toUpperCase() === iata && p.type === "airport") ||
        places.find((p) => p.code?.toUpperCase() === iata);

      if (!match || !match.code) return null;

      const isCity = match.type === "city";
      const city = isCity ? match.name : match.city_name || match.name || "";
      const name = isCity ? "All Airports" : match.name || city;
      const country = match.country_name || "";

      return {
        iata: match.code.toUpperCase(),
        city,
        name,
        country,
        type: isCity ? "city" : "airport",
      };
    } catch (err) {
      console.error("[FlightIQ] Failed to resolve airport by IATA:", err);
      return null;
    }
  });
