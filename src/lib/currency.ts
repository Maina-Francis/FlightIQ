export type CurrencyInfo = {
  code: string;
  symbol: string;
  label: string;
  flag: string;
  /** Units of this currency per 1 USD (indicative, used for display conversion). */
  rate: number;
};

export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", label: "US Dollar", flag: "🇺🇸", rate: 1 },
  KES: { code: "KES", symbol: "KSh", label: "Kenyan Shilling", flag: "🇰🇪", rate: 129 },
  EUR: { code: "EUR", symbol: "€", label: "Euro", flag: "🇪🇺", rate: 0.92 },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", flag: "🇬🇧", rate: 0.78 },
  ZAR: { code: "ZAR", symbol: "R", label: "South African Rand", flag: "🇿🇦", rate: 18.2 },
  NGN: { code: "NGN", symbol: "₦", label: "Nigerian Naira", flag: "🇳🇬", rate: 1580 },
  AED: { code: "AED", symbol: "AED", label: "UAE Dirham", flag: "🇦🇪", rate: 3.67 },
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", flag: "🇮🇳", rate: 83.4 },
  CAD: { code: "CAD", symbol: "C$", label: "Canadian Dollar", flag: "🇨🇦", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", label: "Australian Dollar", flag: "🇦🇺", rate: 1.51 },
  JPY: { code: "JPY", symbol: "¥", label: "Japanese Yen", flag: "🇯🇵", rate: 151 },
};

export const DEFAULT_CURRENCY = "USD";

/** ISO country code -> currency code. Eurozone members map to EUR. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  KE: "KES",
  US: "USD",
  GB: "GBP",
  ZA: "ZAR",
  NG: "NGN",
  AE: "AED",
  IN: "INR",
  CA: "CAD",
  AU: "AUD",
  JP: "JPY",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  IE: "EUR",
  PT: "EUR",
  BE: "EUR",
  AT: "EUR",
  FI: "EUR",
  GR: "EUR",
};

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return DEFAULT_CURRENCY;
  return COUNTRY_CURRENCY[country.toUpperCase()] ?? DEFAULT_CURRENCY;
}

export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY]!;
}

/** Format an amount that is already denominated in the supplied currency. */
export function formatCurrencyAmount(amount: number, code: string): string {
  const currency = getCurrency(code);
  const value = amount;
  const decimals = value >= 1000 ? 0 : value >= 100 ? 0 : 2;
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currency.symbol}${currency.symbol.length > 1 ? " " : ""}${formatted}`;
}

/** Convert between supported currencies via the stored USD-relative display rates. */
export function convertCurrencyAmount(amount: number, fromCode: string, toCode: string): number {
  const from = getCurrency(fromCode);
  const to = getCurrency(toCode);
  return (amount / from.rate) * to.rate;
}

/** Convert a USD base amount into the active currency and format it. */
export function formatPrice(usdAmount: number, code: string): string {
  return formatCurrencyAmount(usdAmount * getCurrency(code).rate, code);
}
