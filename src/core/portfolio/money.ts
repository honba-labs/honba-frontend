import type { Currency, Money } from './types';

const CURRENCY_SYMBOLS: Record<Currency | string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Converts major units to minor units (e.g. ₹1250.50 -> 125050 paise).
 */
export function majorToMinor(major: number, exponent = 2): number {
  return Math.round(major * Math.pow(10, exponent));
}

/**
 * Converts minor units to major units (e.g. 125050 paise -> 1250.50).
 */
export function minorToMajor(minor: number, exponent = 2): number {
  return minor / Math.pow(10, exponent);
}

/**
 * Creates a domain `Money` object in integer minor units (ADR 0011, ADR 0032).
 */
export function toMoney(major: number, currency: Currency = 'INR'): Money {
  return {
    amount: majorToMinor(major),
    currency,
  };
}

/**
 * Extracts the major decimal amount from a `Money` object or raw number.
 */
export function moneyToMajor(money: Money | number | null | undefined): number {
  if (money == null) return 0;
  if (typeof money === 'number') return money;
  if (typeof money.amount !== 'number') return 0;

  // If amount has fractions (legacy float mock), return directly.
  if (!Number.isInteger(money.amount)) {
    return money.amount;
  }
  // Standard wire contract (ADR 0011): amount is integer minor units (paise/cents).
  return minorToMajor(money.amount);
}

/**
 * Formats a Money value or decimal number with currency symbol and locale grouping.
 * e.g. formatMoney(toMoney(125430.5)) => "₹1,25,430.50"
 */
export function formatMoney(
  value: Money | number | null | undefined,
  currency: Currency | string = 'INR',
  options?: {
    showSign?: boolean;
    decimals?: number;
  }
): string {
  const major = moneyToMajor(value);
  const cur = typeof value === 'object' && value?.currency ? value.currency : currency;
  const symbol = CURRENCY_SYMBOLS[cur] ?? cur + ' ';
  const decimals = options?.decimals ?? 2;

  const isNegative = major < 0;
  const absMajor = Math.abs(major);

  let formattedNumber: string;
  if (cur === 'INR') {
    // Indian number system format (lakhs & crores: 1,23,456.78)
    formattedNumber = absMajor.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } else {
    formattedNumber = absMajor.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const sign = isNegative ? '-' : options?.showSign && major > 0 ? '+' : '';
  return `${sign}${symbol}${formattedNumber}`;
}

/**
 * Formats a percentage value (e.g. 0.054 -> "+5.40%" or 5.4 -> "+5.40%").
 */
export function formatPercent(
  percent: number,
  options?: {
    isDecimalFraction?: boolean; // if true, 0.05 means 5%
    showSign?: boolean;
    decimals?: number;
  }
): string {
  const val = options?.isDecimalFraction ? percent * 100 : percent;
  const decimals = options?.decimals ?? 2;
  const sign = val > 0 && options?.showSign !== false ? '+' : val < 0 ? '-' : '';
  const absVal = Math.abs(val).toFixed(decimals);
  return `${sign}${absVal}%`;
}
