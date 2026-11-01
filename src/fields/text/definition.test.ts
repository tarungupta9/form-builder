import { newFieldId } from '../../domain/ids';
import { textField } from '../../test/fixtures';
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
});
