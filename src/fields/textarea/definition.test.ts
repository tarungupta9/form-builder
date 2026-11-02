import { newFieldId } from '../../domain/ids';
import { isoDate, num, text, textareaField } from '../../test/fixtures';
import { textareaDefinition } from './definition';

const withConfig = (config: Partial<ReturnType<typeof textareaField>['config']>) =>
  textareaField('Notes', { config: { placeholder: '', rows: 4, ...config } });

describe('Long text definition', () => {
  it('creates an optional, unlabelled four-row field that passes its own schema', () => {
    const field = textareaDefinition.create(newFieldId());

    expect(field.config.rows).toBe(4);
    expect(field.logic.defaultRequired).toBe(false);
    expect(textareaDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('summarises its height for the canvas', () => {
    expect(textareaDefinition.summarize(withConfig({ rows: 1 }))).toBe('Long text, 1 row');
  });

  describe('settings', () => {
    it('blocks Save when the minimum length exceeds the maximum, or the maximum is zero', () => {
      expect(
        textareaDefinition.validateConfig(withConfig({ minLength: 6, maxLength: 5 }), {
          fields: [],
        }),
      ).toEqual(['The minimum length is more than the maximum.']);
      expect(
        textareaDefinition.validateConfig(withConfig({ maxLength: 0 }), { fields: [] }),
      ).toEqual(['The maximum length must be at least 1.']);
    });

    it('accepts 1 and 30 rows and blocks Save on 0 or 31, instead of clamping them', () => {
      const issues = (rows: number) =>
        textareaDefinition.validateConfig(withConfig({ rows }), { fields: [] });

      expect(issues(1)).toEqual([]);
      expect(issues(30)).toEqual([]);
      expect(issues(0)).toEqual(['Visible rows must be from 1 to 30.']);
      expect(issues(31)).toEqual(['Visible rows must be from 1 to 30.']);
    });

    it('rejects a stored field with 0 or 31 rows', () => {
      expect(textareaDefinition.schema.safeParse(withConfig({ rows: 0 })).success).toBe(false);
      expect(textareaDefinition.schema.safeParse(withConfig({ rows: 31 })).success).toBe(false);
    });
  });

  describe('answers', () => {
    const notes = withConfig({ minLength: 3, maxLength: 5 });

    it('asks for an answer when required and empty or only whitespace and line breaks', () => {
      expect(textareaDefinition.validateValue(notes, undefined, true)).toBe(
        'Enter an answer for Notes',
      );
      expect(textareaDefinition.validateValue(notes, text(' \n\n '), true)).toBe(
        'Enter an answer for Notes',
      );
    });

    it('accepts no answer when optional, even with a minimum length', () => {
      expect(textareaDefinition.validateValue(notes, undefined, false)).toBeNull();
    });

    it('accepts answers at both length limits and rejects one character either side', () => {
      expect(textareaDefinition.validateValue(notes, text('ab'), false)).toBe(
        'Notes must be at least 3 characters',
      );
      expect(textareaDefinition.validateValue(notes, text('abc'), false)).toBeNull();
      expect(textareaDefinition.validateValue(notes, text('abcde'), false)).toBeNull();
      expect(textareaDefinition.validateValue(notes, text('abcdef'), false)).toBe(
        'Notes must be 5 characters or fewer',
      );
    });

    it('counts a line break inside the answer as a character, and an emoji as one', () => {
      expect(textareaDefinition.validateValue(notes, text('ab\ncd'), false)).toBeNull();
      expect(textareaDefinition.validateValue(notes, text('ab\ncde'), false)).toBe(
        'Notes must be 5 characters or fewer',
      );
      expect(textareaDefinition.validateValue(notes, text('😀😀😀'), false)).toBeNull();
    });

    it('reads a text value, refuses another kind, and starts empty', () => {
      expect(textareaDefinition.readValue(notes, text('Hi'))).toEqual(text('Hi'));
      expect(textareaDefinition.readValue(notes, num('5'))).toBeUndefined();
      expect(textareaDefinition.initialValue(notes, isoDate('2026-11-01'))).toBeUndefined();
    });
  });

  describe('export', () => {
    it('keeps the line breaks inside the answer and drops the surrounding whitespace', () => {
      expect(
        textareaDefinition.toExport(withConfig({}), text('\n  Line one\nLine two\n\nEnd  \n')),
      ).toEqual({
        kind: 'answer',
        label: 'Notes',
        value: { kind: 'text', text: 'Line one\nLine two\n\nEnd' },
      });
    });

    it('exports an empty or whitespace-only answer as not answered', () => {
      const notAnswered = { kind: 'answer', label: 'Notes', value: { kind: 'empty' } };

      expect(textareaDefinition.toExport(withConfig({}), undefined)).toEqual(notAnswered);
      expect(textareaDefinition.toExport(withConfig({}), text(' \n '))).toEqual(notAnswered);
    });
  });

  it('is read by conditions as text, like Short text', () => {
    expect(textareaDefinition.conditionTarget(textareaField('Notes'))).toEqual({ kind: 'text' });
  });
});
