import { create } from "zustand";
import { DEFAULT_CURRENCY, CURRENCIES } from "./currency";

const CURRENCY_COOKIE = "flytiq_currency";
const THEME_KEY = "flytiq_theme";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

type CurrencyState = {
  currency: string;
  /** true when the user picked the currency (cookie/local storage overrides detection) */
  userOverride: boolean;
  detectedCountry: string | null;
  detectedCity: string | null;
  hydrate: () => void;
  setDetected: (geo: { country: string | null; city: string | null; currency: string }) => void;
  setCurrency: (code: string) => { from: string; to: string; detectedCountry: string | null };
};

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  currency: DEFAULT_CURRENCY,
  userOverride: false,
  detectedCountry: null,
  detectedCity: null,

  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored =
      readCookie(CURRENCY_COOKIE) ??
      readCookie("flytiq_currency") ??
      window.localStorage.getItem(CURRENCY_COOKIE) ??
      window.localStorage.getItem("flytiq_currency");
    if (stored && CURRENCIES[stored]) {
      set({ currency: stored, userOverride: true });
    }
    const country =
      window.localStorage.getItem("flytiq_country") ??
      window.localStorage.getItem("flytiq_country");
    const city =
      window.localStorage.getItem("flytiq_city") ?? window.localStorage.getItem("flytiq_city");
    if (country) set({ detectedCountry: country });
    if (city) set({ detectedCity: city });
  },

  setDetected: (geo) => {
    if (typeof window !== "undefined") {
      if (geo.country) window.localStorage.setItem("flytiq_country", geo.country);
      if (geo.city) window.localStorage.setItem("flytiq_city", geo.city);
    }
    set((state) => ({
      detectedCountry: geo.country,
      detectedCity: geo.city,
      // Cookie / local storage strictly override IP detection
      currency: state.userOverride
        ? state.currency
        : CURRENCIES[geo.currency]
          ? geo.currency
          : state.currency,
    }));
  },

  setCurrency: (code) => {
    const from = get().currency;
    if (!CURRENCIES[code]) return { from, to: from, detectedCountry: get().detectedCountry };
    writeCookie(CURRENCY_COOKIE, code);
    if (typeof window !== "undefined") window.localStorage.setItem(CURRENCY_COOKIE, code);
    set({ currency: code, userOverride: true });
    return { from, to: code, detectedCountry: get().detectedCountry };
  },
}));

type ThemeState = {
  theme: "dark" | "light";
  hydrate: () => void;
  toggle: () => void;
};

function applyTheme(theme: "dark" | "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored =
      window.localStorage.getItem(THEME_KEY) ?? window.localStorage.getItem("flytiq_theme");
    const theme = stored === "light" ? "light" : "dark";
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    if (typeof window !== "undefined") window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },
}));
