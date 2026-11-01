import { newFieldId, newOptionId } from '../../domain/ids';
import type { MultiSelectConfig } from '../../domain/template';
import { choice, isoDate, multi, multiSelectField, options } from '../../test/fixtures';
import { multiSelectDefinition as definition } from './definition';

const context = { fields: [] };
const withLimits = (limits: Pick<MultiSelectConfig, 'minSelections' | 'maxSelections'>) =>
  multiSelectField('Expense types', {
    config: { options: options('Travel', 'Meals', 'Lodging', 'Other'), ...limits },
  });

describe('Multi select definition', () => {
  it('creates an optional field with two distinct options that passes its own schema', () => {
    const field = definition.create(newFieldId());

    expect(field.config.options.map((option) => option.label)).toEqual(['Option 1', 'Option 2']);
    expect(field.logic.defaultRequired).toBe(false);
    expect(definition.schema.safeParse(field).success).toBe(true);
    expect(definition.validateConfig(field, context)).toEqual([]);
  });

  it('summarises its option count for the canvas', () => {
    expect(definition.summarize(withLimits({}))).toBe('Multi select, 4 options');
  });

  it('rejects a stored field with a negative or fractional limit', () => {
    expect(definition.schema.safeParse(withLimits({ minSelections: -1 })).success).toBe(false);
    expect(definition.schema.safeParse(withLimits({ maxSelections: 1.5 })).success).toBe(false);
  });

  describe('settings that block Save', () => {
    it('accepts limits that some answer can meet, including a maximum above the option count', () => {
      expect(
        definition.validateConfig(withLimits({ minSelections: 2, maxSelections: 2 }), context),
      ).toEqual([]);
      expect(definition.validateConfig(withLimits({ maxSelections: 10 }), context)).toEqual([]);
      expect(definition.validateConfig(withLimits({ minSelections: 0 }), context)).toEqual([]);
    });

    it('flags a minimum above the maximum', () => {
      expect(
        definition.validateConfig(withLimits({ minSelections: 3, maxSelections: 2 }), context),
      ).toEqual(['The minimum number of choices is more than the maximum.']);
    });

    it('flags a minimum above the number of options', () => {
      expect(definition.validateConfig(withLimits({ minSelections: 5 }), context)).toEqual([
        'The minimum number of choices is more than the 4 options available.',
      ]);
    });

    it('flags a maximum of zero, which no answer could meet', () => {
      expect(definition.validateConfig(withLimits({ maxSelections: 0 }), context)).toEqual([
        'The maximum number of choices must be at least 1.',
      ]);
    });

    it('checks its options the same way single select does', () => {
      const field = multiSelectField('Expense types', {
        config: { options: options('Travel', 'travel', '') },
      });
      expect(definition.validateConfig(field, context)).toEqual([
        'Give every option a label.',
        'Option labels must be different from each other.',
      ]);
    });
  });

  describe('answers', () => {
    const field = withLimits({ minSelections: 2, maxSelections: 3 });
    const ids = field.config.options.map((option) => option.id);
    const ticked = (count: number) => multi(...ids.slice(0, count));

    it('accepts a count at the minimum and the maximum, and rejects one either side', () => {
      expect(definition.validateValue(field, ticked(1), false)).toBe(
        'Choose at least 2 options for Expense types',
      );
      expect(definition.validateValue(field, ticked(2), false)).toBeNull();
      expect(definition.validateValue(field, ticked(3), false)).toBeNull();
      expect(definition.validateValue(field, ticked(4), false)).toBe(
        'Choose no more than 3 options for Expense types',
      );
    });

    it('accepts no answer when optional, even with a minimum (O-17)', () => {
      expect(definition.validateValue(field, undefined, false)).toBeNull();
      expect(definition.validateValue(field, multi(), false)).toBeNull();
    });

    it('asks for the minimum when required and empty', () => {
      expect(definition.validateValue(field, multi(), true)).toBe(
        'Choose at least 2 options for Expense types',
      );
    });

    it('asks for at least one option when required and empty with no minimum above one', () => {
      expect(definition.validateValue(withLimits({}), undefined, true)).toBe(
        'Choose at least one option for Expense types',
      );
      expect(definition.validateValue(withLimits({ minSelections: 0 }), multi(), true)).toBe(
        'Choose at least one option for Expense types',
      );
    });

    it('drops deleted options from a stored answer, and refuses a value of another kind', () => {
      const deleted = newOptionId();
      expect(definition.readValue(field, multi(ids[0]!, deleted, ids[2]!))).toEqual(
        multi(ids[0]!, ids[2]!),
      );
      expect(definition.readValue(field, choice(ids[0]!))).toBeUndefined();
    });

    it('starts a new response with nothing ticked', () => {
      expect(definition.initialValue(field, isoDate('2026-11-01'))).toBeUndefined();
    });
  });

  describe('export', () => {
    const field = withLimits({});
    const [travel, meals, lodging] = field.config.options.map((option) => option.id);

    it('exports the ticked labels as a list in option order, not tick order', () => {
      expect(definition.toExport(field, multi(lodging!, travel!))).toEqual({
        kind: 'answer',
        label: 'Expense types',
        value: { kind: 'list', items: ['Travel', 'Lodging'] },
      });
      expect(definition.toExport(field, multi(meals!))).toMatchObject({
        value: { kind: 'list', items: ['Meals'] },
      });
    });

    it('exports nothing ticked as not answered', () => {
      expect(definition.toExport(field, multi())).toMatchObject({ value: { kind: 'empty' } });
      expect(definition.toExport(field, undefined)).toMatchObject({ value: { kind: 'empty' } });
    });
  });
});
