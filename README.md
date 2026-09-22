# FlightIQ

# FlightIQ (flightIQ.app) – System Architecture & Product Requirements Document

## Executive Summary & Full Technology Stack

FlightIQ operates on a zero-friction, free-to-use affiliate monetization model. It monetizes user intent via Skyscanner referral links managed on Impact.com, earning Cost-Per-Click (CPC) and Cost-Per-Acquisition (CPA) commissions without paywalls.

### Core Engineering Tech Stack

- **Frontend Web App:** TanStack Start (SSR, Client Components) + Tailwind CSS + Shadcn UI + Zustand (Global Currency/Search State).
- **Backend / Data Engine:** Travelpayouts (Aviasales Flight Search API) with native multi-provider pricing (OTAs & Airline Direct) and pre-monetized affiliate links.
- **Database & Auth:** Supabase (PostgreSQL with Row Level Security, Realtime Subscriptions).
- **Geolocation & Currency:** IP Geolocation API fallback logic + Zustand LocalStorage/Cookie persistence.
- **Transactional Email:** ZeptoMail API (Zoho) for low-latency HTML price drop alerts.
- **Chat Ecosystem:** Telegram Bot API (`@FlightIQBot`) running webhooks.
- **Affiliate Management:** Impact.com API / Skyscanner Partner Deeplinks (`mediaPartnerId`).
- **Analytics & Tracking:** Google Analytics 4 with custom conversion events.

---

## 2. Geolocation, Currency & Analytics Specification

### 2.1 IP Geolocation & Local Currency Middleware

1. **Client IP Detection:** Backend intercepts incoming request header (`x-forwarded-for` or `cf-connecting-ip`).
2. **Location Lookup:** Queries IP metadata to fetch ISO Country Code and default national currency (e.g., `KE` -> `KES`, `US` -> `USD`, `GB` -> `GBP`, `EU` -> `EUR`).
3. **State Persistence & Navbar Override:**
   - If a user selects a currency in the top navbar dropdown, set cookie `flytiq_currency` and update Zustand state.
   - Local Storage / Cookie values strictly override IP geolocation detection.
   - All flight cards automatically re-render prices based on the globally active currency code.

### 2.2 Google Analytics 4 (GA4) Event Engine

| Event Name            | Trigger Condition                        | Payload Parameters                                     |
| :-------------------- | :--------------------------------------- | :----------------------------------------------------- |
| `flight_search`       | User submits flight search query         | `origin`, `destination`, `departure_date`, `currency`  |
| `currency_changed`    | User manually overrides navbar dropdown  | `from_currency`, `to_currency`, `detected_country`     |
| `affiliate_click`     | User clicks "Select Deal" on flight card | `airline`, `price`, `currency`, `skyscanner_deep_link` |
| `price_alert_created` | User submits email/Telegram alert modal  | `route`, `target_price`, `channel` (email/telegram)    |

---

## Getting Started Locally

To run FlightIQ locally, ensure you have Node.js (v20+) and npm installed.

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional for local development)

Copy `.env.example` to `.env` or set environment variables:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 3. Start Development Server

```bash
npm run dev
```

The application will be running at [http://localhost:5173](http://localhost:5173).

### 4. Build for Production

```bash
npm run build
```
