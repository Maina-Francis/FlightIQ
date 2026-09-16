# FlightIQ — Flight Discovery & Price Tracking

A dark, premium flight search site that earns from Skyscanner affiliate links, with local currency detection, price-drop alerts, and analytics events.

## A note on the stack

Your document specifies Next.js + Express + a separate Supabase project. This platform builds with React and TanStack Start, with the backend (database, logins, server code, email sending) built in. Every capability you listed is covered — server-side geolocation, currency cookies, affiliate deep links, saved alerts, analytics — just handled by the built-in server layer instead of a separate Express app. Global state uses a small store (Zustand equivalent) with cookie persistence, exactly as specced.

## Phase 1 — App shell, brand, navbar, hero, search widget

- Dark slate surface (#0F172A) with crisp ice light mode, indigo primary (#4F46E5), electric cyan accents (#06B6D4), emerald/crimson price indicators, glassmorphism cards, rounded-xl, Plus Jakarta Sans.
- Header: wing/radar mark plus gradient "FlightIQ" logotype; right side has currency dropdown (flag, ISO code, symbol, tooltip "Detected location: … - Click to change"), dark/light toggle, "My Tracked Deals" button.
- Hero: "Smart Flight Tracking. Zero Markup." with the subheadline.
- Search widget: trip-type pills, origin/destination autocomplete with IATA chips (NBO, CPT, LHR…), departure/return date pickers, passengers and cabin class, glowing "Search Flights" CTA.

## Phase 2 — Currency & geolocation

- Server-side lookup of the visitor's IP (x-forwarded-for / cf-connecting-ip) via ipapi.co with an ipinfo.io fallback, mapping country to currency (KE→KES, US→USD, GB→GBP, EU→EUR, …).
- Cookie `flytiq_currency` plus local storage always override detection; every price re-renders in the active currency.

## Phase 3 — Results & affiliate links

- Results page with flight cards: airline, times, airport codes, duration, stops, price in active currency, price-drop badges ("-18% Drop", "Best Local Fare").
- Filter sidebar (stops, airlines, times, price range) and sorting.
- "Select Deal" builds a Skyscanner partner deep link with your media partner ID and opens it in a new tab.
- Fares come from generated sample data until a live fare source is connected, so the whole flow is usable immediately.

## Phase 4 — Price alerts & tracked deals

- Alert modal: route, target price, email or Telegram channel.
- Alerts stored per user in the built-in database with row-level security; "My Tracked Deals" lists and lets you delete them.
- Price-drop emails sent from the server. Telegram bot webhook endpoint added once you provide the bot token.

## Phase 5 — Analytics

- GA4 loaded from your measurement ID, plus the four events with exactly the payloads specced: `flight_search`, `currency_changed`, `affiliate_click`, `price_alert_created`.

## Technical notes

- Routes: `/` (hero + search), `/search` (results), `/deals` (tracked deals), each with its own page title and social metadata.
- Design tokens live in `src/styles.css`; no hardcoded colors in components.
- Server functions handle IP geolocation, affiliate link building, alert CRUD, and email; the Telegram webhook is a public API route with token verification.
- Secrets needed later, requested one at a time when their phase starts: Skyscanner/Impact media partner ID, ZeptoMail API key, Telegram bot token, GA4 measurement ID.

## What I need from you

- Skyscanner/Impact `mediaPartnerId` (placeholder used until then).
- GA4 measurement ID.
- Confirmation that sample fare data is fine for now, or the flight data provider you want.
