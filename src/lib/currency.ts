/**
 * Currency Registry — Single Source of Truth for Multi-Currency Support
 *
 * All currency formatting, validation options, and display config
 * derive from this file. No hardcoded "IDR" or "USD" elsewhere.
 */

export interface CurrencyConfig {
  code: string; // ISO 4217
  name: string;
  symbol: string;
  locale: string; // BCP 47 locale for Intl.NumberFormat
  decimals: number;
  /** Chart axis abbreviation thresholds (optional, falls back to K/M/B) */
  axisSuffixes?: { threshold: number; suffix: string }[];
  /** Mayar.id supports IDR only */
  mayarSupported: boolean;
}

export const CURRENCIES: Record<string, CurrencyConfig> = {
  IDR: {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    locale: "id-ID",
    decimals: 0,
    axisSuffixes: [
      { threshold: 1_000_000_000, suffix: " M" },
      { threshold: 1_000_000, suffix: " Jt" },
      { threshold: 1_000, suffix: " Rb" },
    ],
    mayarSupported: true,
  },
  USD: {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    locale: "en-US",
    decimals: 2,
    mayarSupported: false,
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    locale: "de-DE",
    decimals: 2,
    mayarSupported: false,
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    locale: "en-GB",
    decimals: 2,
    mayarSupported: false,
  },
  SGD: {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    locale: "en-SG",
    decimals: 2,
    mayarSupported: false,
  },
  MYR: {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    locale: "ms-MY",
    decimals: 2,
    mayarSupported: false,
  },
  JPY: {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    locale: "ja-JP",
    decimals: 0,
    mayarSupported: false,
  },
  AUD: {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    locale: "en-AU",
    decimals: 2,
    mayarSupported: false,
  },
};

/** All supported currency codes — for Zod enum validation */
export const CURRENCY_CODES = Object.keys(CURRENCIES) as [string, ...string[]];

/** Default currency */
export const DEFAULT_CURRENCY = "IDR";

/**
 * Get currency config by code, falls back to USD if unknown.
 */
export function getCurrency(code: string): CurrencyConfig {
  return CURRENCIES[code] ?? CURRENCIES.USD;
}

/**
 * Unified money formatter — replaces all scattered formatCurrency/formatIDR.
 *
 * @example
 *   formatMoney(5000000, "IDR")  // "Rp5.000.000"
 *   formatMoney(1234.56, "USD")  // "$1,234.56"
 *   formatMoney("3500", "EUR")   // "3.500,00 €"
 */
export function formatMoney(amount: number | string, currencyCode: string): string {
  const config = getCurrency(currencyCode);
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(Number(amount));
}

/**
 * Chart axis formatter — replaces formatAxisIDR.
 * Uses currency-specific abbreviations when available,
 * falls back to generic K/M/B.
 *
 * @example
 *   formatAxisCurrency(5000000, "IDR")   // "5 Jt"
 *   formatAxisCurrency(3500000, "USD")   // "3.5M"
 */
export function formatAxisCurrency(value: number, currencyCode: string): string {
  const config = getCurrency(currencyCode);

  if (config.axisSuffixes) {
    for (const { threshold, suffix } of config.axisSuffixes) {
      if (value >= threshold) {
        const v = value / threshold;
        return `${v % 1 === 0 ? v : v.toFixed(1)}${suffix}`;
      }
    }
  }

  // Generic K/M/B fallback
  if (value >= 1_000_000_000) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString(config.locale);
}

/**
 * Get currency symbol only.
 *
 * @example
 *   getCurrencySymbol("IDR")  // "Rp"
 *   getCurrencySymbol("USD")  // "$"
 */
export function getCurrencySymbol(currencyCode: string): string {
  return getCurrency(currencyCode).symbol;
}

/**
 * Options array for select/dropdown components.
 */
export function getCurrencyOptions() {
  return Object.values(CURRENCIES).map((c) => ({
    value: c.code,
    label: `${c.symbol} ${c.code} — ${c.name}`,
  }));
}

/**
 * Check if a currency supports Mayar.id payment gateway.
 */
export function isMayarSupported(currencyCode: string): boolean {
  return getCurrency(currencyCode).mayarSupported;
}
