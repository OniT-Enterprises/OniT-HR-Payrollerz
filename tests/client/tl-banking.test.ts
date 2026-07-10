import { describe, expect, it } from 'vitest';
import { validateTLIban } from '@/lib/tlBanking';

describe('TL IBAN validation', () => {
  it('accepts the published ATTL wage-tax account (real-world IBAN)', () => {
    const result = validateTLIban('TL38 0020 0028 6442 1000 162');
    expect(result.valid).toBe(true);
    expect(result.iban).toBe('TL380020002864421000162');
    expect(result.bankCode).toBe('002');
    expect(result.bankName).toContain('BNU');
    expect(result.formatted).toBe('TL38 0020 0028 6442 1000 162');
  });

  it('rejects wrong check digits, wrong length, and non-TL prefixes', () => {
    expect(validateTLIban('TL390020002864421000162').valid).toBe(false);
    expect(validateTLIban('TL38002000286442100016').valid).toBe(false);
    expect(validateTLIban('PT50000201231234567890154').valid).toBe(false);
    expect(validateTLIban('').valid).toBe(false);
    expect(validateTLIban('TL38 0020 0028 644X 1000 162').valid).toBe(false);
  });
});
