/**
 * VAT Module — Barrel Export
 *
 * @onit/shared VAT engine used by both Kaixa (mobile) and Meza (web).
 * VAT is disabled by default (rate 0) until Timor-Leste implements it.
 */
export * from './vat-config';
export * from './vat-calculations';
export * from './vat-invoice';
