import type { FieldId } from '../../domain/ids';
import { numberField, textField } from '../../test/fixtures';
import { describeRequiredChange } from './requiredAnnouncement';

const amount = numberField('Amount');
const receipt = textField('Receipt number');
const notes = textField('Notes');
const approver = textField('Approver');
const fields = [amount, receipt, notes, approver];
const ids = (...listed: { id: FieldId }[]) => new Set(listed.map((field) => field.id));
const all = ids(...fields);
const state = (required: Set<FieldId>, visible = all) => ({ visible, required });

describe('describeRequiredChange', () => {
  it('says nothing when the same fields are required', () => {
    expect(describeRequiredChange(fields, state(ids(receipt)), state(ids(receipt)))).toBeNull();
  });

  it('names a field that became required, or stopped being required', () => {
    expect(describeRequiredChange(fields, state(ids()), state(ids(receipt)))).toBe(
      'Receipt number is now required.',
    );
    expect(describeRequiredChange(fields, state(ids(receipt)), state(ids()))).toBe(
      'Receipt number is no longer required.',
    );
  });

  it('names two fields in form order, counts three or more, and reports both directions together', () => {
    expect(describeRequiredChange(fields, state(ids()), state(ids(notes, receipt)))).toBe(
      'Receipt number and Notes are now required.',
    );
    expect(
      describeRequiredChange(fields, state(ids(amount)), state(ids(receipt, notes, approver))),
    ).toBe('3 fields are now required. Amount is no longer required.');
  });

  it('leaves out a field that appeared or hid, since its visibility change already says so', () => {
    const before = state(ids(), ids(amount, notes));
    const after = state(ids(receipt), ids(amount, receipt));

    expect(describeRequiredChange(fields, before, after)).toBeNull();
  });
});
