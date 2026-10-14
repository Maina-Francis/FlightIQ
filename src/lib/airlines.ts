/**
 * airlines.ts
 * FlightIQ Worldwide Airline Registry & IATA Code Resolver.
 *
 * Dynamically resolves 2-letter IATA carrier codes (e.g. "RJ", "GF", "NO", "SV")
 * to their full passenger-friendly airline names (e.g. "Royal Jordanian", "Gulf Air",
 * "Neos", "Saudia") using Travelpayouts' official worldwide airlines database:
 *   https://api.travelpayouts.com/data/en/airlines.json
 *
 * Seeded with an initial catalog of major global airlines for instant synchronous lookup,
 * and hydrated dynamically in the background to cover all ~1,000+ carriers worldwide.
 */

// ─── Initial Seed Dictionary (Instant sync resolution for major global carriers) ─────
const SEED_AIRLINES: Record<string, string> = {
  // Middle East & North Africa
  RJ: "Royal Jordanian",
  GF: "Gulf Air",
  SV: "Saudia",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  FZ: "flydubai",
  G9: "Air Arabia",
  WY: "Oman Air",
  KU: "Kuwait Airways",
  ME: "Middle East Airlines",
  J9: "Jazeera Airways",
  XY: "flynas",
  MS: "EgyptAir",
  AT: "Royal Air Maroc",
  AH: "Air Algérie",
  TU: "Tunisair",

  // Europe & Mediterranean
  NO: "Neos",
  TK: "Turkish Airlines",
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM Royal Dutch Airlines",
  FR: "Ryanair",
  U2: "easyJet",
  W6: "Wizz Air",
  LX: "SWISS",
  OS: "Austrian Airlines",
  SN: "Brussels Airlines",
  IB: "Iberia",
  TP: "TAP Air Portugal",
  AZ: "ITA Airways",
  SK: "Scandinavian Airlines",
  AY: "Finnair",
  VS: "Virgin Atlantic",
  EI: "Aer Lingus",
  PC: "Pegasus Airlines",
  XC: "Corendon Airlines",
  XQ: "SunExpress",
  TO: "Transavia France",
  HV: "Transavia",
  VY: "Vueling",
  A3: "Aegean Airlines",
  DY: "Norwegian",
  D8: "Norwegian Air Sweden",
  QS: "Smartwings",
  RO: "TAROM",
  FB: "Bulgaria Air",
  JU: "Air Serbia",
  OU: "Croatia Airlines",
  KM: "KM Malta Airlines",
  LO: "LOT Polish Airlines",

  // Africa
  KQ: "Kenya Airways",
  ET: "Ethiopian Airlines",
  SA: "South African Airways",
  WB: "RwandAir",
  TC: "Air Tanzania",
  PW: "Precision Air",
  UR: "Uganda Airlines",
  MD: "Air Madagascar",
  MK: "Air Mauritius",
  HM: "Air Seychelles",
  DT: "TAAG Angola Airlines",
  TM: "LAM Mozambique Airlines",
  VR: "Cabo Verde Airlines",

  // North America
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
  WN: "Southwest Airlines",
  B6: "JetBlue",
  AS: "Alaska Airlines",
  NK: "Spirit Airlines",
  F9: "Frontier Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  PD: "Porter Airlines",
  HA: "Hawaiian Airlines",

  // Latin America
  AM: "Aeroméxico",
  AV: "Avianca",
  CM: "Copa Airlines",
  LA: "LATAM Airlines",
  G3: "Gol Transportes Aéreos",
  AD: "Azul Brazilian Airlines",
  AR: "Aerolíneas Argentinas",
  JA: "JetSMART",

  // Asia & Oceania
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  JL: "Japan Airlines",
  NH: "All Nippon Airways (ANA)",
  MH: "Malaysia Airlines",
  TG: "Thai Airways",
  GA: "Garuda Indonesia",
  VN: "Vietnam Airlines",
  AI: "Air India",
  IX: "Air India Express",
  "6E": "IndiGo",
  SG: "SpiceJet",
  UK: "Vistara",
  QP: "Akasa Air",
  UL: "SriLankan Airlines",
  BG: "Biman Bangladesh Airlines",
  BS: "US-Bangla Airlines",
  PK: "Pakistan International Airlines",
  QF: "Qantas",
  VA: "Virgin Australia",
  NZ: "Air New Zealand",
  JQ: "Jetstar",
  TR: "Scoot",
  AK: "AirAsia",
  FD: "Thai AirAsia",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  CI: "China Airlines",
  BR: "EVA Air",
  CZ: "China Southern Airlines",
  MU: "China Eastern Airlines",
  CA: "Air China",
  HU: "Hainan Airlines",
};

// In-memory dynamic airlines cache
const airlinesCache = new Map<string, string>(Object.entries(SEED_AIRLINES));

let fetchPromise: Promise<void> | null = null;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TravelpayoutsAirlineRaw {
  name: string | null;
  alias?: string | null;
  iata: string | null;
  icao?: string | null;
  name_translations?: Record<string, string> | null;
  country_code?: string | null;
  is_lowcost?: boolean | null;
}

/**
 * Hydrate airlines asynchronously from Travelpayouts' global database.
 * Deduplicates in-flight calls and respects 24-hour cache TTL.
 */
export async function loadAirlinesDatabase(): Promise<void> {
  const now = Date.now();
  if (airlinesCache.size > 200 && now - lastFetchedAt < CACHE_TTL_MS) {
    return;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("https://api.travelpayouts.com/data/en/airlines.json", {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "FlightIQ/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.warn(`[FlightIQ] Travelpayouts airlines.json returned HTTP ${res.status}`);
        return;
      }

      const list = (await res.json()) as TravelpayoutsAirlineRaw[];
      if (Array.isArray(list)) {
        let addedCount = 0;
        for (const item of list) {
          const rawCode = item.iata || (item as { code?: string }).code;
          if (!rawCode) continue;
          const code = String(rawCode).trim().toUpperCase();
          const name = item.name_translations?.["en"] || item.name;
          if (code && name) {
            airlinesCache.set(code, name.trim());
            addedCount++;
          }
        }
        lastFetchedAt = Date.now();
        console.log(`[FlightIQ] Hydrated ${addedCount} airlines from Travelpayouts database.`);
      }
    } catch (err: unknown) {
      // Non-fatal: fallback to seed dictionary
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[FlightIQ] Could not fetch remote airlines database (${msg}), using seed catalog.`,
      );
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

/**
 * Returns the full human-readable airline name for a given 2-letter IATA code.
 * E.g.:
 *   getAirlineName("RJ") => "Royal Jordanian"
 *   getAirlineName("GF") => "Gulf Air"
 *   getAirlineName("NO") => "Neos"
 *   getAirlineName("SV") => "Saudia"
 */
export function getAirlineName(iataCode?: string | null): string {
  if (!iataCode) return "Airline";
  const code = iataCode.trim().toUpperCase();
  if (!code || code === "??") return "Airline";

  const cached = airlinesCache.get(code);
  if (cached) return cached;

  // Trigger background fetch if we encounter an unknown carrier
  if (airlinesCache.size <= Object.keys(SEED_AIRLINES).length && !fetchPromise) {
    void loadAirlinesDatabase();
  }

  return code;
}

/**
 * Returns an airline logo URL hosted by Aviasales' CDN.
 */
export function getAirlineLogoUrl(iataCode?: string | null): string | null {
  if (!iataCode) return null;
  const code = iataCode.trim().toUpperCase();
  if (!code || code === "??") return null;
  return `https://pics.avs.io/al_square/64/64/${code}.png`;
}
