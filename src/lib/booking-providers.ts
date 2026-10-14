/**
 * booking-providers.ts
 * Maps Aviasales gate codes (the `gate` field on AviasalesDataPrice) to
 * human-readable brand names and optional brand colours so that the
 * BookingProviderModal can show real OTA names instead of raw gate IDs.
 */

export interface ProviderMeta {
  /** Display name shown to users. */
  name: string;
  /** Hex accent colour for the provider chip/badge. */
  color: string;
  /** Whether this OTA typically sells airline-direct fares. */
  isAirlineDirect?: boolean;
}

/**
 * Normalise a raw gate string from the Aviasales API into a lookup key.
 * Strips whitespace and lower-cases the value.
 */
export function normaliseGateKey(gate: string): string {
  return gate.trim().toLowerCase().replace(/\s+/g, "");
}

/** Lookup map: normalised gate key → provider metadata. */
export const PROVIDER_MAP: Record<string, ProviderMeta> = {
  // Kiwi / Kissandfly
  kiwi: { name: "Kiwi.com", color: "#00b2a9" },
  kissandfly: { name: "Kiwi.com", color: "#00b2a9" },
  "kiwi.com": { name: "Kiwi.com", color: "#00b2a9" },

  // Trip.com
  trip: { name: "Trip.com", color: "#1a73e8" },
  "trip.com": { name: "Trip.com", color: "#1a73e8" },
  ctrip: { name: "Trip.com", color: "#1a73e8" },

  // eDreams
  edreams: { name: "eDreams", color: "#e67e00" },
  "e-dreams": { name: "eDreams", color: "#e67e00" },
  odigeo: { name: "eDreams", color: "#e67e00" },

  // Expedia
  expedia: { name: "Expedia", color: "#fbce07" },
  "expedia.com": { name: "Expedia", color: "#fbce07" },

  // Booking.com
  booking: { name: "Booking.com", color: "#0079a5" },
  "booking.com": { name: "Booking.com", color: "#0079a5" },

  // Skyscanner
  skyscanner: { name: "Skyscanner", color: "#05a5d1" },

  // Momondo
  momondo: { name: "Momondo", color: "#7b2ff7" },

  // Kayak
  kayak: { name: "Kayak", color: "#ff690f" },

  // OneTravel
  onetravel: { name: "OneTravel", color: "#e63946" },

  // Priceline
  priceline: { name: "Priceline", color: "#1a3c5e" },

  // Gotogate
  gotogate: { name: "Gotogate", color: "#f05537" },

  // BudgetAir
  budgetair: { name: "BudgetAir", color: "#006c3b" },

  // Wego
  wego: { name: "Wego", color: "#ff6a00" },

  // Almosafer
  almosafer: { name: "Almosafer", color: "#00a650" },

  // FlightNetwork
  flightnetwork: { name: "FlightNetwork", color: "#003f87" },

  // Bravofly / lastminute.com
  bravofly: { name: "Lastminute.com", color: "#cc0001" },
  lastminute: { name: "Lastminute.com", color: "#cc0001" },
  "lastminute.com": { name: "Lastminute.com", color: "#cc0001" },

  // Traveloka
  traveloka: { name: "Traveloka", color: "#009ac7" },

  // MakeMyTrip
  makemytrip: { name: "MakeMyTrip", color: "#e23232" },

  // Cleartrip
  cleartrip: { name: "Cleartrip", color: "#e94560" },

  // Airline Direct
  direct: { name: "Airline Direct", color: "#22c55e", isAirlineDirect: true },
  airline: { name: "Airline Direct", color: "#22c55e", isAirlineDirect: true },
};

/**
 * Looks up a ProviderMeta for a gate code string.
 * Returns a sensible default if the gate is unknown.
 */
export function getProviderMeta(gate: string | null | undefined): ProviderMeta {
  if (!gate) {
    return { name: "Aviasales Partner", color: "#e84393" };
  }

  const key = normaliseGateKey(gate);
  return (
    PROVIDER_MAP[key] ??
    // Try a prefix match for compound gate IDs like "kissandfly_v2"
    Object.entries(PROVIDER_MAP).find(([k]) => key.startsWith(k))?.[1] ?? {
      // Unknown gate — capitalise the raw value as best-effort brand name
      name: gate.charAt(0).toUpperCase() + gate.slice(1),
      color: "#6366f1",
    }
  );
}
