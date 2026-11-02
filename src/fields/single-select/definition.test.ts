import { newFieldId, newOptionId } from '../../domain/ids';
import { toExportModel } from '../../features/export/exportModel';
import {
  choice,
  isoDate,
  multi,
  options,
  singleSelectField,
  submittedResponse,
  template,
} from '../../test/fixtures';
import { singleSelectDefinition as definition } from './definition';

const context = { fields: [] };
const withOptions = (...labels: string[]) =>
  singleSelectField('Payment method', {
    config: { options: options(...labels), display: 'radio' },
  });

describe('Single select definition', () => {
  it('creates an optional radio field with two distinct options that passes its own schema', () => {
    const field = definition.create(newFieldId());

    expect(field.config.display).toBe('radio');
    expect(field.config.options.map((option) => option.label)).toEqual(['Option 1', 'Option 2']);
    expect(field.logic.defaultRequired).toBe(false);
    expect(definition.schema.safeParse(field).success).toBe(true);
    expect(definition.validateConfig(field, context)).toEqual([]);
  });

  it('summarises its display and option count for the canvas', () => {
    const field = withOptions('Card', 'Cash');
    expect(definition.summarize(field)).toBe('Single select as radio buttons, 2 options');
    expect(definition.summarize({ ...field, config: { ...field.config, display: 'tiles' } })).toBe(
      'Single select as tiles, 2 options',
    );
  });

  it('rejects a stored field with an unknown display or an option without an ID', () => {
    const field = withOptions('Card');
    expect(
      definition.schema.safeParse({ ...field, config: { ...field.config, display: 'slider' } })
        .success,
    ).toBe(false);
    expect(
      definition.schema.safeParse({
        ...field,
        config: { ...field.config, options: [{ id: 'not-a-uuid', label: 'Card' }] },
      }).success,
    ).toBe(false);
  });

  describe('settings that block Save', () => {
    it('accepts a single option, such as "I confirm"', () => {
      expect(definition.validateConfig(withOptions('I confirm'), context)).toEqual([]);
    });

    it('asks for at least one option', () => {
      expect(definition.validateConfig(withOptions(), context)).toEqual([
        'Add at least one option.',
      ]);
    });

    it('asks for a label on every option, counting whitespace as empty', () => {
      expect(definition.validateConfig(withOptions('Card', '  '), context)).toEqual([
        'Give every option a label.',
      ]);
    });

    it('rejects two options whose labels differ only in case or surrounding spaces', () => {
      expect(definition.validateConfig(withOptions('Card', ' card '), context)).toEqual([
        'Option labels must be different from each other.',
      ]);
    });
  });

  describe('answers', () => {
    const field = withOptions('Card', 'Cash');
    const [card] = field.config.options;

    it('asks for a choice when required and nothing is chosen', () => {
      expect(definition.validateValue(field, undefined, true)).toBe(
        'Choose an option for Payment method',
      );
      expect(definition.validateValue(field, choice(null), true)).toBe(
        'Choose an option for Payment method',
      );
    });

    it('accepts no choice when optional, and any choice either way', () => {
      expect(definition.validateValue(field, undefined, false)).toBeNull();
      expect(definition.validateValue(field, choice(card!.id), true)).toBeNull();
    });

    it('reads a choice of one of its options', () => {
      expect(definition.readValue(field, choice(card!.id))).toEqual(choice(card!.id));
    });

    it('reads a deleted option, no choice, or a value of another kind as no answer', () => {
      expect(definition.readValue(field, choice(newOptionId()))).toBeUndefined();
      expect(definition.readValue(field, choice(null))).toBeUndefined();
      expect(definition.readValue(field, multi(card!.id))).toBeUndefined();
    });

    it('starts a new response with nothing chosen', () => {
      expect(definition.initialValue(field, isoDate('2026-11-01'))).toBeUndefined();
    });
  });

  describe('renaming an option (D-11)', () => {
    const field = withOptions('Card', 'Cash');
    const cash = field.config.options[1]!;
    const answer = choice(cash.id);
    // The builder edits immutably, so the renamed field is a new object with the same option ID.
    const renamed = {
      ...field,
      config: {
        ...field.config,
        options: field.config.options.map((o) => (o.id === cash.id ? { ...o, label: 'Coins' } : o)),
      },
    };

    it('keeps the answer, which now reads with the new label', () => {
      expect(definition.readValue(renamed, answer)).toEqual(answer);
      expect(definition.toExport(renamed, definition.readValue(renamed, answer))).toEqual({
        kind: 'answer',
        label: 'Payment method',
        value: { kind: 'text', text: 'Coins' },
      });
    });

    it('still exports the old label for a response submitted before the rename (D-10)', () => {
      const form = template([field]);
      const response = submittedResponse(form, { [field.id]: answer });
      form.fields = [renamed];

      expect(toExportModel(response).blocks).toEqual([
        { kind: 'answer', label: 'Payment method', value: { kind: 'text', text: 'Cash' } },
      ]);
    });
  });

  describe('export', () => {
    const field = withOptions('Card', 'Cash');

    it('exports the chosen option’s label', () => {
      expect(definition.toExport(field, choice(field.config.options[0]!.id))).toEqual({
        kind: 'answer',
        label: 'Payment method',
        value: { kind: 'text', text: 'Card' },
      });
    });

    it('exports no choice as not answered', () => {
      expect(definition.toExport(field, undefined)).toEqual({
        kind: 'answer',
        label: 'Payment method',
        value: { kind: 'empty' },
      });
    });
  });

  it('offers its options to conditions, in option order', () => {
    const field = singleSelectField('Expense type', {
      config: { options: options('Travel', 'Meals'), display: 'dropdown' },
    });

    expect(definition.conditionTarget(field)).toEqual({
      kind: 'choice',
      options: field.config.options,
    });
  });
});
