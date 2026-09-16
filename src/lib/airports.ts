/**
 * airports.ts
 * Dynamic in-memory airport registry for FlightIQ.
 * All airport metadata is fetched dynamically from Duffel API worldwide.
 */

export type Airport = {
  iata: string;
  city: string;
  name: string;
  country: string;
};

const airportRegistry = new Map<string, Airport>();

export function registerAirport(a: Airport): void {
  if (a && a.iata) {
    airportRegistry.set(a.iata.toUpperCase(), a);
  }
}

export function findAirport(iata: string): Airport | undefined {
  if (!iata) return undefined;
  return airportRegistry.get(iata.toUpperCase());
}

export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase();
  const allAirports = Array.from(airportRegistry.values());
  if (!q) return allAirports.slice(0, limit);
  return allAirports
    .filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
