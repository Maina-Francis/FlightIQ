/**
 * Skyscanner partner deep links with Impact.com affiliate tracking.
 * Pre-filters results directly by airline, stops, cabin, departure time window, and passengers.
 */

export interface DeepLinkParams {
  origin: string; // e.g., "CPT"
  destination: string; // e.g., "LHR"
  departureDate: string; // "YYYY-MM-DD"
  returnDate?: string | null | undefined; // "YYYY-MM-DD"
  adults?: number | undefined;
  cabinClass?: string | undefined;
  cabin?: string | undefined; // alias for cabinClass
  carrierCode?: string | undefined; // 2-letter IATA code, e.g. "LH"
  stops?: number | undefined; // Exact number of stops (e.g. 0, 1, 2)
  departureTime?: string | undefined; // e.g., "15:20" or ISO string
  currency?: string | undefined;
  mediaPartnerId?: string | undefined;
}

export type DeepLinkInput = DeepLinkParams;

export function buildSkyscannerDeepLink(params: DeepLinkParams): string {
  const {
    origin,
    destination,
    departureDate,
    returnDate,
    adults = 1,
    cabinClass = "economy",
    cabin,
    carrierCode,
    stops,
    departureTime,
    currency,
    mediaPartnerId,
  } = params;

  // Format date YYMMDD
  const formatDate = (d: string) => {
    const dateOnly = d.split("T")[0] ?? d;
    return dateOnly.replace(/-/g, "").slice(2);
  };
  const outbound = formatDate(departureDate);
  const inbound = returnDate ? `/${formatDate(returnDate)}` : "";

  const queryParams = new URLSearchParams({
    adultsv2: adults.toString(),
    cabinclass: (cabinClass ?? cabin ?? "economy").toLowerCase(),
  });

  if (carrierCode && carrierCode !== "??") {
    queryParams.append("airlines", carrierCode.toUpperCase());
  }
  if (stops !== undefined && stops !== null) {
    queryParams.append("stops", stops.toString());
  }
  if (currency) {
    queryParams.append("currency", currency.toUpperCase());
  }

  // Map departure hour to Skyscanner time window
  if (departureTime) {
    const timeStr = (departureTime.includes("T") ? departureTime.split("T")[1] : departureTime) || "";
    const hour = parseInt(timeStr.split(":")[0] ?? "0", 10);

    if (!isNaN(hour)) {
      if (hour < 6) queryParams.append("outboundtime", "night");
      else if (hour < 12) queryParams.append("outboundtime", "morning");
      else if (hour < 18) queryParams.append("outboundtime", "afternoon");
      else queryParams.append("outboundtime", "evening");
    }
  }

  const destinationUrl = `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${outbound}${inbound}/?${queryParams.toString()}`;

  const partnerId =
    mediaPartnerId ||
    (typeof process !== "undefined" ? process.env?.["VITE_SKYSCANNER_PARTNER_ID"] : undefined) ||
    (typeof import.meta !== "undefined" && import.meta.env
      ? (import.meta.env["VITE_SKYSCANNER_PARTNER_ID"] as string | undefined)
      : undefined) ||
    "7758264";

  return `https://skyscanner.pxf.io/c/${partnerId}/1219808/13404?u=${encodeURIComponent(destinationUrl)}`;
}

// ─── Direct Airline Official Site Directory ───────────────────────────────────

const AIRLINE_WEBSITES: Record<string, string> = {
  LH: "https://www.lufthansa.com",
  KQ: "https://www.kenya-airways.com",
  EK: "https://www.emirates.com",
  QR: "https://www.qatarairways.com",
  TK: "https://www.turkishairlines.com",
  ET: "https://www.ethiopianairlines.com",
  BA: "https://www.britishairways.com",
  KL: "https://www.klm.com",
  AF: "https://www.airfrance.com",
  QF: "https://www.qantas.com",
  SQ: "https://www.singaporeair.com",
  DL: "https://www.delta.com",
  UA: "https://www.united.com",
  AA: "https://www.aa.com",
  AC: "https://www.aircanada.com",
  CX: "https://www.cathaypacific.com",
  EY: "https://www.etihad.com",
  MS: "https://www.egyptair.com",
  SA: "https://www.flysaa.com",
  WB: "https://www.rwandair.com",
  AT: "https://www.royalairmaroc.com",
  SV: "https://www.saudia.com",
  WY: "https://www.omanair.com",
  LX: "https://www.swiss.com",
  OS: "https://www.austrian.com",
  SN: "https://www.brusselsairlines.com",
  IB: "https://www.iberia.com",
  TP: "https://www.flytap.com",
  AZ: "https://www.ita-airways.com",
  SK: "https://www.flysas.com",
  AY: "https://www.finnair.com",
  VS: "https://www.virginatlantic.com",
  JL: "https://www.jal.co.jp",
  NH: "https://www.ana.co.jp",
  MH: "https://www.malaysiaairlines.com",
  TG: "https://www.thaiairways.com",
  GA: "https://www.garuda-indonesia.com",
  VN: "https://www.vietnamairlines.com",
  AI: "https://www.airindia.com",
  NZ: "https://www.airnewzealand.com",
  LA: "https://www.latamairlines.com",
  AV: "https://www.avianca.com",
  CM: "https://www.copaair.com",
  AM: "https://www.aeromexico.com",
  FR: "https://www.ryanair.com",
  U2: "https://www.easyjet.com",
  W6: "https://www.wizzair.com",
  F9: "https://www.flyfrontier.com",
  NK: "https://www.spirit.com",
  B6: "https://www.jetblue.com",
  WN: "https://www.southwest.com",
  AS: "https://www.alaskaair.com",
  WS: "https://www.westjet.com",
};

/**
 * Returns the official direct website for an airline, with smart fallbacks.
 */
export function getAirlineWebsite(carrierCode?: string, airlineName?: string): string {
  if (carrierCode) {
    const site = AIRLINE_WEBSITES[carrierCode.toUpperCase()];
    if (site) return site;
  }
  if (airlineName) {
    const cleanName = airlineName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanName.length > 2) {
      return `https://www.${cleanName}.com`;
    }
  }
  return "https://www.google.com/travel/flights";
}
