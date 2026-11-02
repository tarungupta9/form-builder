import { newFieldId } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import type { FieldOf } from '../../domain/template';
import { calculationField, num, numberField, textField } from '../../test/fixtures';
import { NOT_A_NUMBER_SOURCE, NO_SOURCES, calculationDefinition } from './definition';

const hotel = numberField('Hotel', { decimals: 2 });
const meals = numberField('Meals', { decimals: 2 });
const taxi = numberField('Taxi', { decimals: 2 });

const derive = (field: FieldOf<'calculation'>, effective: ResponseValues) =>
  calculationDefinition.derivation?.derive(field, effective);

describe('Calculation definition', () => {
  it('creates a two-decimal sum with no sources that passes its own schema', () => {
    const field = calculationDefinition.create(newFieldId());

    expect(field.config).toEqual({ sourceFieldIds: [], aggregation: 'sum', decimals: 2 });
    expect('defaultRequired' in field.logic).toBe(false);
    expect(calculationDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('summarises its aggregation and how many sources it reads', () => {
    const field = calculationField('Average', [hotel, meals], { aggregation: 'average' });
    expect(calculationDefinition.summarize(field)).toBe('Calculation, average of 2 Number fields');
  });

  it('can never be a condition target', () => {
    expect(calculationDefinition.conditionTarget(calculationField())).toBeNull();
  });

  describe('settings (D-12)', () => {
    it('blocks Save when it has no sources', () => {
      const field = calculationField('Total', []);
      expect(calculationDefinition.validateConfig(field, { fields: [field] })).toEqual([
        NO_SOURCES,
      ]);
    });

    it('blocks Save when a source is another calculation, or is not in the form', () => {
      const other = calculationField('Subtotal', [hotel]);
      const field = calculationField('Total', [hotel]);
      const readsCalculation = {
        ...field,
        config: { ...field.config, sourceFieldIds: [other.id] },
      };
      const fields = [hotel, other, readsCalculation];

      expect(calculationDefinition.validateConfig(readsCalculation, { fields })).toEqual([
        NOT_A_NUMBER_SOURCE,
      ]);
      expect(calculationDefinition.validateConfig(field, { fields: [field] })).toEqual([
        NOT_A_NUMBER_SOURCE,
      ]);
    });

    it('accepts Number sources', () => {
      const field = calculationField('Total', [hotel, meals]);
      expect(
        calculationDefinition.validateConfig(field, { fields: [hotel, meals, field] }),
      ).toEqual([]);
    });

    it('drops a removed source and keeps the rest in order', () => {
      const field = calculationField('Total', [hotel, meals, taxi]);
      const cleaned = calculationDefinition.derivation?.withoutSource(field, meals.id);

      expect(cleaned?.config.sourceFieldIds).toEqual([hotel.id, taxi.id]);
      expect(calculationDefinition.derivation?.withoutSource(field, textField().id)).toBe(field);
    });
  });

  describe('result (D-14)', () => {
    it.each([
      ['sum', '200.00'],
      ['average', '66.67'],
      ['min', '30.00'],
      ['max', '120.00'],
    ] as const)('computes the %s of the sources', (aggregation, expected) => {
      const field = calculationField('Result', [hotel, meals, taxi], { aggregation });
      const values = { [hotel.id]: num('120'), [meals.id]: num('50'), [taxi.id]: num('30') };

      expect(derive(field, values)).toEqual(num(expected));
    });

    it('averages over the filled sources only', () => {
      const field = calculationField('Average', [hotel, meals, taxi], { aggregation: 'average' });

      expect(
        derive(field, { [hotel.id]: num('120'), [meals.id]: num(''), [taxi.id]: num('30') }),
      ).toEqual(num('75.00'));
    });

    it('is empty, never 0, when every source is empty', () => {
      const field = calculationField('Total', [hotel, meals]);

      expect(derive(field, {})).toBeUndefined();
      expect(derive(field, { [hotel.id]: num(' ') })).toBeUndefined();
    });

    it('leaves out a source that is absent from the effective values, as a hidden one is', () => {
      const field = calculationField('Total', [hotel, taxi]);
      // `effective` never holds a hidden field, so Taxi's typed 30 is simply not there.
      expect(derive(field, { [hotel.id]: num('120') })).toEqual(num('120.00'));
    });

    it('leaves out a source that is not a number yet, such as "12a"', () => {
      const field = calculationField('Total', [hotel, meals]);
      expect(derive(field, { [hotel.id]: num('12a'), [meals.id]: num('8') })).toEqual(num('8.00'));
    });

    it('rounds to its own decimal places', () => {
      const field = calculationField('Average', [hotel, meals], {
        aggregation: 'average',
        decimals: 0,
      });
      expect(derive(field, { [hotel.id]: num('1'), [meals.id]: num('2') })).toEqual(num('2'));
    });
  });

  describe('export', () => {
    it('shows the result with its decimal places', () => {
      const field = calculationField('Total', [hotel]);
      expect(calculationDefinition.toExport(field, num('1234.5'))).toEqual({
        kind: 'answer',
        label: 'Total',
        value: { kind: 'text', text: '1,234.50' },
      });
    });

    it('says there was nothing to calculate when the result is empty', () => {
      expect(calculationDefinition.toExport(calculationField('Total'), undefined)).toEqual({
        kind: 'answer',
        label: 'Total',
        value: { kind: 'empty', text: 'Nothing to calculate' },
      });
    });
  });
});
