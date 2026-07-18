/**
 * Currency Utilities
 * Uses Decimal.js for precise financial calculations
 * Avoids floating-point drift in payroll totals
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for currency operations
Decimal.set({
  precision: 20,        // High precision for intermediate calculations
  rounding: Decimal.ROUND_HALF_UP, // Currency half-up rounding (not half-even/banker's rounding)
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
 * Multiply a monetary value by several non-money factors, rounding only once.
 * Use this for lines such as hourly rate × hours × overtime multiplier; rounding
 * between factors can introduce a one-cent payroll error.
 */
export function multiplyMoneyByFactors(value: number, ...factors: number[]): number {
  const result = factors.reduce(
    (amount, factor) => amount.times(toDecimal(factor)),
    toDecimal(value),
  );
  return toMoney(result);
}

/**
 * Multiply one value into several money lines, round their combined total once,
 * then allocate any rounding cent back to the lines. This keeps the displayed
 * lines equal to the displayed total for accounting conventions that aggregate
 * before rounding.
 */
export function multiplyMoneyPartsToRoundedTotal(
  value: number,
  factorSets: readonly (readonly number[])[],
): number[] {
  const exactParts = factorSets.map((factors) =>
    factors.reduce(
      (amount, factor) => amount.times(toDecimal(factor)),
      toDecimal(value),
    ),
  );
  const roundedParts = exactParts.map(toMoney);
  const targetTotal = toMoney(
    exactParts.reduce((total, amount) => total.plus(amount), new Decimal(0)),
  );
  let differenceInCents = toDecimal(targetTotal)
    .minus(roundedParts.reduce((total, amount) => total.plus(amount), new Decimal(0)))
    .times(100)
    .toNumber();

  while (differenceInCents !== 0) {
    const direction = Math.sign(differenceInCents);
    let selectedIndex = -1;
    let selectedResidual: Decimal | undefined;

    exactParts.forEach((exact, index) => {
      if (exact.isZero()) return;
      const residual = exact.minus(roundedParts[index]);
      if (
        selectedResidual === undefined
        || (direction > 0 && residual.greaterThan(selectedResidual))
        || (direction < 0 && residual.lessThan(selectedResidual))
      ) {
        selectedIndex = index;
        selectedResidual = residual;
      }
    });

    if (selectedIndex < 0) break;
    roundedParts[selectedIndex] = toMoney(
      toDecimal(roundedParts[selectedIndex]).plus(toDecimal(direction).dividedBy(100)),
    );
    differenceInCents -= direction;
  }

  return roundedParts;
}

/**
 * Divide currency value by a divisor
 */
export function divideMoney(value: number, divisor: number): number {
  if (divisor === 0) return 0;
  return toMoney(toDecimal(value).dividedBy(divisor));
}

/** Divide and round a non-negative monetary rate upward to the next cent. */
export function divideMoneyRoundUp(value: number, divisor: number): number {
  if (divisor === 0) return 0;
  return toDecimal(value)
    .dividedBy(divisor)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL)
    .toNumber();
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

/** Round a monetary amount to whole dollars using the configured half-up rule. */
export function roundWholeMoney(value: number): number {
  return toDecimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Compare currency values without binary floating-point drift. */
export function compareMoney(a: number, b: number): -1 | 0 | 1 {
  return toDecimal(a).comparedTo(toDecimal(b)) as -1 | 0 | 1;
}

/**
 * Get maximum of currency values
 */
export function maxMoney(...values: number[]): number {
  return toMoney(Decimal.max(...values.map(toDecimal)));
}

/**
 * Calculate pro-rata amount
 * e.g., proRata(1000, 5, 12) = 1000 * 5/12
 */
export function proRata(amount: number, numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return toMoney(toDecimal(amount).times(numerator).dividedBy(denominator));
}
