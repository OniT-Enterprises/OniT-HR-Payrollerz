/**
 * Currency Utilities
 * Uses Decimal.js for precise financial calculations
 * Avoids floating-point drift in payroll totals
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for currency operations
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export function toDecimal(value: number | string | null | undefined): Decimal {
  if (value === null || value === undefined) {
    return new Decimal(0);
  }
  return new Decimal(value);
}

export function toMoney(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function addMoney(...values: (number | Decimal)[]): number {
  let sum = new Decimal(0);
  for (const val of values) {
    sum = sum.plus(val instanceof Decimal ? val : toDecimal(val));
  }
  return toMoney(sum);
}

export function subtractMoney(base: number, ...values: (number | Decimal)[]): number {
  let result = toDecimal(base);
  for (const val of values) {
    result = result.minus(val instanceof Decimal ? val : toDecimal(val));
  }
  return toMoney(result);
}

export function multiplyMoney(value: number, factor: number): number {
  return toMoney(toDecimal(value).times(factor));
}

export function divideMoney(value: number, divisor: number): number {
  if (divisor === 0) return 0;
  return toMoney(toDecimal(value).dividedBy(divisor));
}

export function percentOf(value: number, percent: number): number {
  return toMoney(toDecimal(value).times(percent).dividedBy(100));
}

export function applyRate(value: number, rate: number): number {
  return toMoney(toDecimal(value).times(rate));
}

export function sumMoney(values: number[]): number {
  return toMoney(
    values.reduce((sum, val) => sum.plus(toDecimal(val)), new Decimal(0))
  );
}

export function roundMoney(value: number): number {
  return toMoney(toDecimal(value));
}

export function compareMoney(a: number, b: number): -1 | 0 | 1 {
  const comparison = toDecimal(a).comparedTo(toDecimal(b));
  return comparison as -1 | 0 | 1;
}

export function isPositive(value: number): boolean {
  return toDecimal(value).isPositive();
}

export function isNegative(value: number): boolean {
  return toDecimal(value).isNegative();
}

export function maxMoney(...values: number[]): number {
  return toMoney(Decimal.max(...values.map(toDecimal)));
}

export function minMoney(...values: number[]): number {
  return toMoney(Decimal.min(...values.map(toDecimal)));
}

export function proRata(amount: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return toMoney(toDecimal(amount).times(numerator).dividedBy(denominator));
}

export function formatMoney(value: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
