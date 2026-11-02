import type { FieldId } from '../../domain/ids';
import { num, numberField, text, textField } from '../../test/fixtures';
import { describeVisibilityChange } from './visibilityAnnouncement';

const nights = numberField('Nights');
const reason = textField('Approval reason');
const notes = textField('Notes');
const fields = [nights, reason, notes];
const ids = (...shown: { id: FieldId }[]) => new Set(shown.map((field) => field.id));

describe('describeVisibilityChange', () => {
  it('says nothing when the same fields are visible', () => {
    expect(describeVisibilityChange(fields, ids(nights), ids(nights), {})).toBeNull();
  });

  it('names one or two fields that appeared, in form order', () => {
    expect(describeVisibilityChange(fields, ids(), ids(nights), {})).toBe('Nights shown.');
    expect(describeVisibilityChange(fields, ids(), ids(reason, nights), {})).toBe(
      'Nights and Approval reason shown.',
    );
  });

  it('counts three or more, so a long list never floods the screen reader', () => {
    expect(describeVisibilityChange(fields, ids(), ids(nights, reason, notes), {})).toBe(
      '3 fields shown.',
    );
  });

  it('reports fields shown and hidden in one change together', () => {
    expect(describeVisibilityChange(fields, ids(reason), ids(nights), {})).toBe(
      'Nights shown, Approval reason hidden.',
    );
  });

  it('says that a hidden field’s answer will not be submitted, only when it had one (D6-8)', () => {
    expect(describeVisibilityChange(fields, ids(nights), ids(), { [nights.id]: num('4') })).toBe(
      'Nights hidden. Its answer won’t be submitted.',
    );
    expect(describeVisibilityChange(fields, ids(nights), ids(), { [nights.id]: num(' ') })).toBe(
      'Nights hidden.',
    );
    expect(
      describeVisibilityChange(fields, ids(nights, reason), ids(), {
        [reason.id]: text('Conference'),
      }),
    ).toBe('Nights and Approval reason hidden. Answers in hidden fields won’t be submitted.');
  });
});
