import { newResponseId, toIsoDateTime } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import { evaluateForm } from '../../domain/rules/evaluate';
import type { FormTemplate } from '../../domain/template';
import { condition, group, template, text, textField } from '../../test/fixtures';
import { toSubmittedResponse } from './submission';

const submit = (form: FormTemplate, values: ResponseValues) =>
  toSubmittedResponse(form, evaluateForm(form.fields, values), {
    id: newResponseId(),
    startedAt: toIsoDateTime(new Date('2026-11-01T09:00:00Z')),
    submittedAt: toIsoDateTime(new Date('2026-11-01T09:05:00Z')),
  });

describe('toSubmittedResponse', () => {
  const receipt = textField('Do you have a receipt?');
  const reason = textField('Why not?');
  reason.logic.hide = group(
    'all',
    condition(receipt.id, { kind: 'text', op: 'equals', value: 'yes' }),
  );
  const amount = textField('Amount');
  const form = { ...template([receipt, reason, amount]), description: 'For travel only.' };

  it('leaves a hidden field’s value out of the submitted record', () => {
    const response = submit(form, {
      [receipt.id]: text('yes'),
      [reason.id]: text('Lost it'),
      [amount.id]: text('40'),
    });

    expect(response.answers).toEqual({ [receipt.id]: text('yes'), [amount.id]: text('40') });
  });

  it('snapshots the title, description and the visible fields, in form order', () => {
    const response = submit(form, { [receipt.id]: text('yes') });

    expect(response.snapshot).toEqual({
      title: form.title,
      description: 'For travel only.',
      fields: [receipt, amount],
    });
  });

  it('leaves out answers the respondent left blank', () => {
    const response = submit(form, { [receipt.id]: text('no'), [reason.id]: text('   ') });

    expect(response.answers).toEqual({ [receipt.id]: text('no') });
    expect(response.snapshot.fields).toEqual([receipt, reason, amount]);
  });

  it('records when the form was opened and when it was submitted', () => {
    const response = submit(form, {});

    expect(response).toMatchObject({
      status: 'submitted',
      templateId: form.id,
      createdAt: '2026-11-01T09:00:00.000Z',
      submittedAt: '2026-11-01T09:05:00.000Z',
    });
  });
});
