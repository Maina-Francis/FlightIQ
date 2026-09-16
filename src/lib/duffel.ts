import { Duffel } from "@duffel/api";

const duffelApiKey =
  process.env.DUFFEL_API_KEY ?? process.env["DUFFEL_API_KEY"];

if (!duffelApiKey) {
  console.warn("[FlightIQ] DUFFEL_API_KEY is missing from environment variables.");
}

export const duffel = new Duffel({
  token: duffelApiKey || "",
});

export function isDuffelConfigured(): boolean {
  return Boolean(duffelApiKey);
}
