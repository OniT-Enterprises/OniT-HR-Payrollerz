/**
 * Currency Utilities
 * Uses Decimal.js for precise financial calculations
 * Avoids floating-point drift in payroll totals
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for currency operations
Decimal.set({
  precision: 20,        // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Standard banking rounding
});

/**
 * Create a Decimal from a number
 * Handles null/undefined gracefully
 */
export function toDecimal(value: number | string | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

/**
 * Convert Decimal back to number, rounded to 2 decimal places
 */
export function toMoney(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Add multiple currency values
 */
export function addMoney(...values: (number | Decimal)[]): number {
  let sum = new Decimal(0);
  for (const val of values) {
    sum = sum.plus(val instanceof Decimal ? val : toDecimal(val));
  }
  return toMoney(sum);
}

/**
 * Subtract currency values: a - b - c ...
 */
export function subtractMoney(base: number, ...values: (number | Decimal)[]): number {
  let result = toDecimal(base);
  for (const val of values) {
    result = result.minus(val instanceof Decimal ? val : toDecimal(val));
  }
  return toMoney(result);
}

/**
 * Multiply currency value by a factor
 */
export function multiplyMoney(value: number, factor: number): number {
  return toMoney(toDecimal(value).times(factor));
}

/**
 * Divide currency value by a divisor
 */
export function divideMoney(value: number, divisor: number): number {
  if (divisor === 0) return 0;
  return toMoney(toDecimal(value).dividedBy(divisor));
}

/**
 * Calculate percentage of a value
 */
export function percentOf(value: number, percent: number): number {
  return toMoney(toDecimal(value).times(percent).dividedBy(100));
}

/**
 * Calculate rate (e.g., tax rate, INSS rate)
 * rate should be decimal (e.g., 0.10 for 10%)
 */
export function applyRate(value: number, rate: number): number {
  return toMoney(toDecimal(value).times(rate));
}

/**
 * Sum an array of numbers with precision
 */
export function sumMoney(values: number[]): number {
  return toMoney(
    values.reduce((sum, val) => sum.plus(toDecimal(val)), new Decimal(0))
  );
}

/**
 * Round to nearest cent (2 decimal places)
 */
export function roundMoney(value: number): number {
  return toMoney(toDecimal(value));
}

/**
 * Compare two currency values
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareMoney(a: number, b: number): -1 | 0 | 1 {
  const comparison = toDecimal(a).comparedTo(toDecimal(b));
  return comparison as -1 | 0 | 1;
}

/**
 * Check if value is positive
 */
export function isPositive(value: number): boolean {
  return toDecimal(value).isPositive();
}

/**
 * Check if value is negative
 */
export function isNegative(value: number): boolean {
  return toDecimal(value).isNegative();
}

/**
 * Get maximum of currency values
 */
export function maxMoney(...values: number[]): number {
  return toMoney(Decimal.max(...values.map(toDecimal)));
}

/**
 * Get minimum of currency values
 */
export function minMoney(...values: number[]): number {
  return toMoney(Decimal.min(...values.map(toDecimal)));
}

/**
 * Calculate pro-rata amount
 * e.g., proRata(1000, 5, 12) = 1000 * 5/12
 */
export function proRata(amount: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return toMoney(toDecimal(amount).times(numerator).dividedBy(denominator));
}

/**
 * Format currency for display
 */
export function formatMoney(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
