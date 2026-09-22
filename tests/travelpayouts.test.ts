import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  fetchFlightPrices,
  buildAviasalesPartnerUrl,
  generateAviasalesSignature,
  isTravelpayoutsConfigured,
  TRAVELPAYOUTS_TOKEN,
  TRAVELPAYOUTS_MARKER,
} from "../src/lib/travelpayouts";

describe("Aviasales Data API v3 & Partner Deep Links", () => {
  test("fetchFlightPrices returns HTTP 200 with array of flight fares", async () => {
    const results = await fetchFlightPrices({
      origin: "CPT",
      destination: "LON",
      departureDate: "2026-09-23",
      currency: "usd",
    });

    console.log(`[Test] fetchFlightPrices returned ${results.length} fares.`);
    assert.ok(Array.isArray(results), "Expected array of flight fares");
    assert.ok(results.length > 0, "Expected at least 1 flight fare returned");

    const sample = results[0];
    console.log("[Test] Sample fare:", {
      airline: sample.airline,
      flight_number: sample.flight_number,
      price: sample.price,
      departure_at: sample.departure_at,
      transfers: sample.transfers,
      duration: sample.duration,
      gate: sample.gate,
    });

    assert.equal(sample.origin, "CPT");
    assert.equal(sample.destination, "LON");
    assert.ok(typeof sample.price === "number" && sample.price > 0);
    assert.ok(sample.airline, "Expected airline code");
  });

  test("buildAviasalesPartnerUrl constructs valid route segment and marker", () => {
    const url = buildAviasalesPartnerUrl({
      origin: "CPT",
      destination: "LON",
      departureDate: "2026-09-23",
      adults: 1,
    });

    console.log("[Test] Generated partner URL:", url);
    assert.equal(
      url,
      `https://www.aviasales.com/search/CPT2309LON1?marker=${TRAVELPAYOUTS_MARKER}`,
    );
    assert.ok(url.includes(`marker=${TRAVELPAYOUTS_MARKER}`));
  });

  test("buildAviasalesPartnerUrl handles return flights", () => {
    const url = buildAviasalesPartnerUrl({
      origin: "NBO",
      destination: "DXB",
      departureDate: "2026-10-01",
      returnDate: "2026-10-15",
      adults: 2,
    });

    console.log("[Test] Generated return partner URL:", url);
    assert.equal(
      url,
      `https://www.aviasales.com/search/NBO0110DXB15102?marker=${TRAVELPAYOUTS_MARKER}`,
    );
  });
});

describe("Travelpayouts Aviasales MD5 Signature Generator", () => {
  const sampleToken = "test_token_12345";
  const sampleMarker = "778298";

  test("generates expected MD5 hash using exact parameter ordering", () => {
    const params = {
      currency_code: "USD",
      locale: "en",
      market_code: "us",
      origin: "JFK",
      destination: "LHR",
      date: "2026-11-15",
      return_date: "2026-11-22",
      adults: 2,
      children: 1,
      infants: 0,
      trip_class: "Y",
    };

    const signature = generateAviasalesSignature(
      sampleToken,
      sampleMarker,
      params,
    );

    const expectedRaw = [
      sampleToken,
      "USD",
      "en",
      sampleMarker,
      "us",
      "2026-11-15",
      "LHR",
      "JFK",
      "2026-11-22",
      2,
      1,
      0,
      "Y",
    ].join(":");

    const expectedHash = crypto
      .createHash("md5")
      .update(expectedRaw)
      .digest("hex");

    assert.equal(signature, expectedHash);
    assert.match(signature, /^[a-f0-9]{32}$/);
  });
});
