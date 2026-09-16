import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { SearchWidget } from "@/components/search-widget";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { detectLocation } from "@/lib/geo.functions";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import {
  TrendingDown,
  Globe,
  Bell,
  ShieldCheck,
  Send,
  Search,
  Target,
  BellRing,
  Plane,
  ChevronDown,
  ArrowRight,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlightIQ — Smart Flight Tracking. Zero Markup." },
      {
        name: "description",
        content:
          "Track flight prices and get instant alerts when fares drop. Search flights, set price alerts via email or Telegram, and book directly with the airline. No hidden fees.",
      },
      { property: "og:title", content: "FlightIQ — Smart Flight Tracking" },
      {
        property: "og:description",
        content:
          "Track flight prices and get instant alerts when fares drop. Email or Telegram notifications, local currency, zero markup.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: TrendingDown,
    title: "Price Drop Alerts",
    desc: "Get notified the moment fares drop below your target — via email or Telegram.",
  },
  {
    icon: Globe,
    title: "Local Currency",
    desc: "Prices auto-detect your location and display in your local currency.",
  },
  {
    icon: ShieldCheck,
    title: "Zero Markup",
    desc: "We never add fees. You book directly with the airline through Skyscanner.",
  },
];

const STEPS = [
  {
    icon: Search,
    title: "Search Any Route",
    desc: "Enter your origin, destination, and travel dates. We scan live airline fares across hundreds of carriers in real time.",
  },
  {
    icon: Target,
    title: "Set Your Target",
    desc: "Pick a target price or choose to be alerted on any price drop. Select email or Telegram for instant notifications.",
  },
  {
    icon: BellRing,
    title: "Get Notified",
    desc: "We monitor your route around the clock. The moment fares drop, you get an alert with a direct booking link.",
  },
];

const POPULAR_ROUTES = [
  { from: "NBO", to: "CPT", fromCity: "Nairobi", toCity: "Cape Town" },
  { from: "NBO", to: "DAR", fromCity: "Nairobi", toCity: "Dar es Salaam" },
  { from: "NBO", to: "JNB", fromCity: "Nairobi", toCity: "Johannesburg" },
  { from: "NBO", to: "DXB", fromCity: "Nairobi", toCity: "Dubai" },
  { from: "NBO", to: "LHR", fromCity: "Nairobi", toCity: "London" },
  { from: "DAR", to: "CPT", fromCity: "Dar es Salaam", toCity: "Cape Town" },
];

const FAQS = [
  {
    q: "How does flight price tracking work?",
    a: "After you set up an alert, our scanner checks cached flight prices for your route on a regular schedule. When the fare drops below your target price — or drops from the previous scan for any-drop trackers — we send you an instant notification via your chosen channel (email or Telegram). You get a direct booking link so you can act fast before the price changes again.",
  },
  {
    q: "What's the difference between a target price and any price drop?",
    a: "A target price alert fires only when the fare drops below a specific amount you set. An any-price-drop alert fires whenever the fare decreases from the previous scan, regardless of the absolute price. Both are rate-limited to one notification per 24 hours per tracker, so you won't be spammed.",
  },
  {
    q: "How do Telegram alerts work?",
    a: "Choose Telegram as your notification channel when setting up an alert. You'll get a link to connect with our bot. Once linked, price drop notifications arrive directly in your Telegram chat with a one-tap booking link. You can also create trackers from within Telegram using the /track command.",
  },
  {
    q: "Do you add any booking fees or markup?",
    a: "No. We never add fees to the prices you see. When you click to book, you're redirected to Skyscanner, which connects you directly with the airline. You always pay the airline's price — we just help you find and track it.",
  },
  {
    q: "When is the best time to book a flight?",
    a: "There's no single perfect moment — fares fluctuate with demand, seasonality, and route popularity. Analysis shows domestic tickets are usually cheapest 1-3 months before departure, while international fares often drop 2-6 months out. Instead of guessing, set a price alert and let us notify you when fares dip.",
  },
  {
    q: "Can I manage or deactivate my trackers?",
    a: "Yes. Visit the My Tracked Deals page to view all your active trackers, see which routes are being monitored, and deactivate any tracker with one click. You can also manage alerts from Telegram using the /deals command.",
  },
];

function Index() {
  const { hydrate, setDetected } = useCurrencyStore();
  const { hydrate: hydrateTheme } = useThemeStore();

  useEffect(() => {
    hydrateTheme();
    hydrate();
    initAnalytics();
    trackPageView("/");

    detectLocation().then((geo) => {
      if (geo.country || geo.currency) {
        setDetected(geo);
      }
    });
  }, [hydrate, hydrateTheme, setDetected]);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        {/* Ambient mint glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]"
        />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Live fare tracking across 30+ airports
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tighter text-foreground sm:text-6xl lg:text-7xl lg:leading-[0.95]">
            Track flight prices.
            <br />
            <span className="text-primary italic">Never overpay again.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Search flights, set price drop alerts, and book directly with the airline. No hidden
            fees, no middleman — just the best fares in your local currency, delivered to your
            inbox or Telegram.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <div
            aria-hidden
            className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/25 to-coral/25 blur-lg"
          />
          <div className="glow-ring relative">
            <SearchWidget />
          </div>
        </div>
      </section>

      {/* ─── Feature Cards ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group glass-panel rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 transition-colors group-hover:bg-primary/25">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How It Works
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Set up flight price tracking in three simple steps. We handle the monitoring so you
              can focus on planning your trip.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="glass-panel h-full rounded-2xl p-7 transition-all duration-300 hover:border-primary/40">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="font-display text-xs font-bold uppercase tracking-widest text-coral">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 text-primary/50 sm:block">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why Track Flights ────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="grid grid-cols-1 gap-8 p-8 sm:p-10 lg:grid-cols-2">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Flight prices change constantly.
                  <br />
                  <span className="text-primary italic">We watch them for you.</span>
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  Airline fares fluctuate due to demand, seasonality, seat availability, and
                  competitor pricing. Instead of refreshing websites daily or hoping for a deal,
                  set a price alert and let our scanner do the work. The moment fares drop, you'll
                  know — with a direct booking link ready to go.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    { icon: Clock, text: "Monitors your route 24/7 — no manual checking" },
                    { icon: Bell, text: "Instant alerts via email or Telegram the moment prices drop" },
                    { icon: BarChart3, text: "Rate-limited to one alert per 24 hours — no spam" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-8 glow-cta gap-2">
                  <Link to="/search">
                    <Search className="h-4 w-4" />
                    Start Tracking Flights
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-sm">
                  {/* Mock notification card */}
                  <div className="glass-panel rounded-2xl border border-success/30 p-5 shadow-lg">
                    <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15">
                        <TrendingDown className="h-4 w-4 text-success" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">Price Drop Alert</p>
                        <p className="text-[10px] text-muted-foreground">FlightIQ · just now</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">NBO</span>
                        <Plane className="h-3.5 w-3.5 text-primary" />
                        <span className="font-mono text-sm font-bold text-foreground">CPT</span>
                        <span className="text-[10px] text-muted-foreground">· 12 Oct</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-success">KES 38,500</span>
                        <span className="text-xs text-muted-foreground line-through">KES 52,000</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="text-[11px] font-medium text-success">
                          26% below your target
                        </span>
                      </div>
                      <div className="mt-3 rounded-lg bg-coral/15 px-3 py-2 text-center">
                        <span className="text-xs font-bold text-coral">Book on Skyscanner →</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Popular Routes ───────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Popular Routes to Track
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Set up alerts on these high-demand routes and get notified when fares drop.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {POPULAR_ROUTES.map((route) => (
              <Link
                key={`${route.from}-${route.to}`}
                to="/search"
                search={{
                  origin: route.from,
                  destination: route.to,
                  departureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0]!,
                  tripType: "oneway" as const,
                  adults: 1,
                  cabin: "economy" as const,
                }}
                className="glass-panel group flex items-center justify-between rounded-xl p-4 transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Plane className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-bold text-foreground">
                        {route.from}
                      </span>
                      <span className="text-primary">→</span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {route.to}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {route.fromCity} to {route.toCity}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Telegram Bot CTA ─────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="grid grid-cols-1 items-center gap-8 p-8 sm:p-10 lg:grid-cols-2">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#229ED9]/15 px-3 py-1 text-xs font-semibold text-[#229ED9]">
                  <Send className="h-3.5 w-3.5" />
                  Telegram Bot
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Track flights right from Telegram
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Use our Telegram bot to search flights, set price alerts, and get instant
                  notifications — all from a simple chat. No app to download, no account to
                  create.
                </p>
                <ul className="mt-5 space-y-2">
                  {[
                    "/track NBO CPT 85000 — set a target price alert",
                    "/track NBO CPT any — alert on any price drop",
                    "/deals — view your active trackers",
                  ].map((cmd) => (
                    <li key={cmd} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-foreground">
                        {cmd}
                      </code>
                    </li>
                  ))}
                </ul>
                <a
                  href="https://t.me/FlightIQBot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#229ED9] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                  Start on Telegram
                  <ArrowRight className="h-3.5 w-3.5 opacity-75" />
                </a>
              </div>

              <div className="flex items-center justify-center">
                <div className="w-full max-w-xs space-y-3">
                  {/* Mock Telegram chat */}
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#229ED9] px-4 py-2.5 text-sm text-white shadow-sm">
                    /track NBO CPT 85000
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card/80 px-4 py-3 shadow-sm">
                    <p className="text-sm font-bold text-foreground">Tracker Set!</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Monitoring NBO → CPT. We'll notify you when fares drop below 85,000.
                    </p>
                  </div>
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#229ED9] px-4 py-2.5 text-sm text-white shadow-sm">
                    /deals
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card/80 px-4 py-3 shadow-sm">
                    <p className="text-sm font-bold text-foreground">Your Active Trackers</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      1. NBO → CPT — below KES 85,000
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Answers to common questions about flight price tracking and how FlightIQ helps you
              secure the best deals.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="glass-panel rounded-xl border border-border/70 px-5"
              >
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline">
                  <div className="flex items-center gap-3 pr-4">
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary transition-transform" />
                    {faq.q}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="glass-panel rounded-2xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Never miss a price drop
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Flight prices change constantly. Set a price alert and we'll notify you the moment
              fares drop — so you can book at the right time and save.
            </p>
            <Button asChild size="lg" className="mt-6 glow-cta gap-2">
              <Link to="/search">
                <Search className="h-4 w-4" />
                Search & Track Flights
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>
          FlightIQ — Flight discovery and price tracking. Fares are indicative and for comparison
          purposes.
        </p>
      </footer>
    </div>
  );
}
