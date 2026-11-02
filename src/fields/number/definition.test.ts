import { newFieldId } from '../../domain/ids';
import type { NumberConfig } from '../../domain/template';
import { isoDate, num, numberField, text } from '../../test/fixtures';
import { numberDefinition } from './definition';

const issues = (config: Partial<NumberConfig>) =>
  numberDefinition.validateConfig(numberField('Amount', config), { fields: [] });
const check = (config: Partial<NumberConfig>, input: string, required = false) =>
  numberDefinition.validateValue(numberField('Amount', config), num(input), required);

describe('Number definition', () => {
  it('creates an optional whole-number field that passes its own schema', () => {
    const field = numberDefinition.create(newFieldId());

    expect(field.config.decimals).toBe(0);
    expect(field.logic.defaultRequired).toBe(false);
    expect(numberDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('rejects a stored field with an unsupported number of decimals', () => {
    const field = { ...numberField(), config: { decimals: 5, prefix: '', suffix: '' } };
    expect(numberDefinition.schema.safeParse(field).success).toBe(false);
  });

  it('summarises its precision and adornments for the canvas', () => {
    expect(numberDefinition.summarize(numberField('Amount', { decimals: 2, prefix: '$' }))).toBe(
      'Number, 2 decimal places, starts “$”',
    );
    expect(numberDefinition.summarize(numberField())).toBe('Number, whole numbers');
  });

  describe('settings', () => {
    it('blocks Save when the minimum exceeds the maximum, and allows them equal', () => {
      expect(issues({ min: 10, max: 5 })).toEqual(['The minimum value is more than the maximum.']);
      expect(issues({ min: 5, max: 5 })).toEqual([]);
    });

    it('blocks Save when a limit has more decimal places than answers may have', () => {
      expect(issues({ decimals: 0, min: 0.5 })).toEqual([
        'The minimum has more decimal places than this field allows.',
      ]);
      expect(issues({ decimals: 1, max: 9.99 })).toEqual([
        'The maximum has more decimal places than this field allows.',
      ]);
      expect(issues({ decimals: 2, min: 0.25, max: 9.99 })).toEqual([]);
    });
  });

  describe('answers', () => {
    it('asks for a number when required and empty, and accepts empty when optional', () => {
      expect(check({}, '', true)).toBe('Enter a number for Amount');
      expect(check({}, '   ', true)).toBe('Enter a number for Amount');
      expect(check({}, '', false)).toBeNull();
    });

    it('rejects exponents, thousands separators and letters, with an example in the right shape', () => {
      expect(check({ decimals: 2 }, '1e3')).toBe('Enter a number for Amount, like 24.50');
      expect(check({ decimals: 2 }, '1,000')).toBe('Enter a number for Amount, like 24.50');
      expect(check({}, '12a')).toBe('Enter a number for Amount, like 24');
    });

    it('ignores spaces around the number, and accepts negatives', () => {
      expect(check({}, ' 12 ')).toBeNull();
      expect(check({}, '-3')).toBeNull();
    });

    it('refuses extra decimals rather than rounding them (D-15)', () => {
      expect(check({ decimals: 2 }, '1.505')).toBe('Use up to 2 decimal places for Amount');
      expect(check({ decimals: 2 }, '1.50')).toBeNull();
      expect(check({ decimals: 1 }, '1.25')).toBe('Use up to 1 decimal place for Amount');
      expect(check({ decimals: 0 }, '1.5')).toBe('Enter a whole number for Amount');
    });

    it('accepts both limits and rejects values just outside them', () => {
      const range = { decimals: 1 as const, min: -1, max: 10 };
      expect(check(range, '-1')).toBeNull();
      expect(check(range, '10')).toBeNull();
      expect(check(range, '-1.1')).toBe('Amount must be -1 or more');
      expect(check(range, '10.1')).toBe('Amount must be 10 or less');
    });

    it('reads a number value, refuses another kind, and starts empty', () => {
      const field = numberField();
      expect(numberDefinition.readValue(field, num('5'))).toEqual(num('5'));
      expect(numberDefinition.readValue(field, text('5'))).toBeUndefined();
      expect(numberDefinition.initialValue(field, isoDate('2026-11-01'))).toBeUndefined();
    });
  });

  describe('export', () => {
    const decimal = (value: number, places: number) =>
      new Intl.NumberFormat(undefined, {
        minimumFractionDigits: places,
        maximumFractionDigits: places,
      }).format(value);

    it('shows the number to the configured decimals, with its prefix and a spaced word suffix', () => {
      const price = numberField('Price', { decimals: 2, prefix: '$' });
      const weight = numberField('Weight', { suffix: 'kg' });
      const share = numberField('Share', { suffix: '%' });

      expect(numberDefinition.toExport(price, num('1234.5'))).toEqual({
        kind: 'answer',
        label: 'Price',
        value: { kind: 'text', text: `$${decimal(1234.5, 2)}` },
      });
      expect(numberDefinition.toExport(weight, num('12'))).toMatchObject({
        value: { text: '12 kg' },
      });
      expect(numberDefinition.toExport(share, num('40'))).toMatchObject({ value: { text: '40%' } });
    });

    it('exports an empty answer as not answered, without its adornments', () => {
      expect(numberDefinition.toExport(numberField('Price', { prefix: '$' }), num(' '))).toEqual({
        kind: 'answer',
        label: 'Price',
        value: { kind: 'empty' },
      });
    });
  });

  it('is read by conditions as a number', () => {
    expect(numberDefinition.conditionTarget(numberField('Nights'))).toEqual({ kind: 'number' });
  });
});
