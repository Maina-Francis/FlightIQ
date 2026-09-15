/**
 * Skyscanner partner deep links.
 * Set VITE_SKYSCANNER_PARTNER_ID to your Impact.com mediaPartnerId.
 */
const DEFAULT_PARTNER_ID =
  (typeof process !== "undefined" ? process.env?.["VITE_SKYSCANNER_PARTNER_ID"] : undefined) ??
  (typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env["VITE_SKYSCANNER_PARTNER_ID"] as string | undefined)
    : undefined) ??
  "flightIQ-pending";

export type DeepLinkInput = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  adults: number;
  cabin?: string;
  cabinClass?: string;
  currency?: string;
  mediaPartnerId?: string;
};

function compact(date: string) {
  // Handles both YYYY-MM-DD and ISO 8601 YYYY-MM-DDTHH:mm:ss.sssZ
  const dateOnly = date.split("T")[0] ?? date;
  const [y, m, d] = dateOnly.split("-");
  return `${(y ?? "").slice(2)}${m ?? ""}${d ?? ""}`;
}

export function buildSkyscannerDeepLink(input: DeepLinkInput): string {
  const partnerId = input.mediaPartnerId || DEFAULT_PARTNER_ID;
  const cabin = (input.cabinClass ?? input.cabin ?? "economy").toLowerCase();
  const currency = input.currency ?? "USD";

  const legs = [
    input.origin.toLowerCase(),
    input.destination.toLowerCase(),
    compact(input.departureDate),
    input.returnDate ? compact(input.returnDate) : "",
  ]
    .filter(Boolean)
    .join("/");

  const params = new URLSearchParams({
    adults: String(input.adults),
    cabinclass: cabin,
    currency,
    associateid: partnerId,
    utm_source: "flightIQ",
    utm_medium: "affiliate",
  });

  return `https://www.skyscanner.net/transport/flights/${legs}/?${params.toString()}`;
}
