import { newFieldId } from '../../domain/ids';
import { isoDate, num, text, textField } from '../../test/fixtures';
import { textDefinition } from './definition';

const withLimits = (minLength?: number, maxLength?: number) =>
  textField('Name', { config: { placeholder: '', minLength, maxLength, prefix: '', suffix: '' } });

describe('Short text definition', () => {
  it('creates an optional, unlabelled field that passes its own schema', () => {
    const field = textDefinition.create(newFieldId());

    expect(field.logic.defaultRequired).toBe(false);
    expect(textDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('accepts equal minimum and maximum lengths', () => {
    expect(textDefinition.validateConfig(withLimits(5, 5), { fields: [] })).toEqual([]);
  });

  it('flags a minimum length above the maximum', () => {
    expect(textDefinition.validateConfig(withLimits(6, 5), { fields: [] })).toEqual([
      'The minimum length is more than the maximum.',
    ]);
  });

  it('flags a maximum length of zero, which no answer could meet', () => {
    expect(textDefinition.validateConfig(withLimits(undefined, 0), { fields: [] })).toEqual([
      'The maximum length must be at least 1.',
    ]);
  });

  it('summarises its prefix and suffix for the canvas', () => {
    const field = textField('Website', {
      config: { placeholder: '', prefix: 'https://', suffix: '.com' },
    });

    expect(textDefinition.summarize(field)).toBe('Short text, starts “https://”, ends “.com”');
  });

  it('rejects a stored field with a negative length', () => {
    expect(textDefinition.schema.safeParse(withLimits(-1)).success).toBe(false);
  });

  describe('answers', () => {
    const name = withLimits(2, 5);

    it('asks for an answer when required and empty, counting whitespace as empty', () => {
      expect(textDefinition.validateValue(name, undefined, true)).toBe('Enter an answer for Name');
      expect(textDefinition.validateValue(name, text('   '), true)).toBe(
        'Enter an answer for Name',
      );
    });

    it('accepts no answer when optional, even with a minimum length', () => {
      expect(textDefinition.validateValue(name, text(''), false)).toBeNull();
    });

    it('accepts answers at both length limits and rejects one character either side', () => {
      expect(textDefinition.validateValue(name, text('Al'), false)).toBeNull();
      expect(textDefinition.validateValue(name, text('Alice'), false)).toBeNull();
      expect(textDefinition.validateValue(name, text('A'), false)).toBe(
        'Name must be at least 2 characters',
      );
      expect(textDefinition.validateValue(name, text('Alicia'), false)).toBe(
        'Name must be 5 characters or fewer',
      );
    });

    it('measures length without the surrounding spaces, and counts an emoji as one character', () => {
      expect(textDefinition.validateValue(name, text('  Al  '), false)).toBeNull();
      expect(textDefinition.validateValue(name, text('😀😀'), false)).toBeNull();
    });

    it('reads a text value and refuses a value of another kind', () => {
      expect(textDefinition.readValue(name, text('Ada'))).toEqual(text('Ada'));
      expect(textDefinition.readValue(name, num('5'))).toBeUndefined();
    });

    it('starts a new response empty', () => {
      expect(textDefinition.initialValue(name, isoDate('2026-11-01'))).toBeUndefined();
    });
  });

  describe('export', () => {
    const website = textField('Website', {
      config: { placeholder: '', prefix: 'https://', suffix: '.com' },
    });

    it('exports an answer with its prefix and suffix, as the respondent saw it', () => {
      expect(textDefinition.toExport(website, text('  acme '))).toEqual({
        kind: 'answer',
        label: 'Website',
        value: { kind: 'text', text: 'https://acme.com' },
      });
    });

    it('exports an empty or whitespace-only answer as not answered, without its adornments', () => {
      const notAnswered = { kind: 'answer', label: 'Website', value: { kind: 'empty' } };

      expect(textDefinition.toExport(website, undefined)).toEqual(notAnswered);
      expect(textDefinition.toExport(website, text('   '))).toEqual(notAnswered);
    });

    it('falls back to "Untitled field" for a field with no label', () => {
      expect(textDefinition.toExport(textField('  '), text('Ada'))).toMatchObject({
        label: 'Untitled field',
      });
    });
  });

  it('is read by conditions as text', () => {
    expect(textDefinition.conditionTarget(textField('Name'))).toEqual({ kind: 'text' });
  });
});
