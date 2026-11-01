import { newResponseId, toIsoDateTime } from '../../domain/ids';
import { evaluateForm } from '../../domain/rules/evaluate';
import type { ResponseValues } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import {
  condition,
  group,
  submittedResponse,
  template,
  text,
  textField,
} from '../../test/fixtures';
import { toSubmittedResponse } from '../fill/submission';
import { pdfFileName, toExportModel } from './exportModel';

const submit = (form: FormTemplate, values: ResponseValues) =>
  toSubmittedResponse(form, evaluateForm(form.fields, values), {
    id: newResponseId(),
    startedAt: toIsoDateTime(new Date('2026-11-01T09:00:00Z')),
    submittedAt: toIsoDateTime(new Date('2026-11-01T09:05:00Z')),
  });

describe('toExportModel', () => {
  it('carries the snapshot’s title, description, response ID and submission time', () => {
    const form = { ...template([textField('Name')], 'Expense claim'), description: 'Travel only.' };
    const response = submittedResponse(
      form,
      {},
      {
        submittedAt: toIsoDateTime(new Date('2026-11-01T14:05:00Z')),
      },
    );

    expect(toExportModel(response)).toMatchObject({
      title: 'Expense claim',
      description: 'Travel only.',
      responseId: response.id,
      submittedAt: '2026-11-01T14:05:00.000Z',
    });
  });

  it('lists blocks in the snapshot’s form order, not the order the answers were given', () => {
    const first = textField('First');
    const second = textField('Second');
    const response = submittedResponse(template([first, second]), {
      [second.id]: text('typed first'),
      [first.id]: text('typed second'),
    });

    expect(
      toExportModel(response).blocks.map((block) => block.kind === 'answer' && block.label),
    ).toEqual(['First', 'Second']);
  });

  it('reads "not answered" for a field the respondent left empty', () => {
    const notes = textField('Notes');
    const response = submittedResponse(template([notes]));

    expect(toExportModel(response).blocks).toEqual([
      { kind: 'answer', label: 'Notes', value: { kind: 'empty' } },
    ]);
  });

  it('builds the export from the snapshot alone, so a renamed field keeps its old label', () => {
    const name = textField('Employee name');
    const form = template([name]);
    const response = submittedResponse(form, { [name.id]: text('Ada') });
    // The template is edited after the response was submitted.
    form.fields[0] = { ...name, label: 'Full name' };
    form.title = 'Renamed claim';

    const exported = toExportModel(response);

    expect(exported.title).toBe('Expense claim');
    expect(exported.blocks).toEqual([
      { kind: 'answer', label: 'Employee name', value: { kind: 'text', text: 'Ada' } },
    ]);
  });

  it('leaves out a field that was hidden at submit, label and value both', () => {
    const receipt = textField('Do you have a receipt?');
    const reason = textField('Why not?');
    reason.logic.hide = group(
      'all',
      condition(receipt.id, { kind: 'text', op: 'equals', value: 'yes' }),
    );
    const form = template([receipt, reason]);

    const exported = toExportModel(
      submit(form, { [receipt.id]: text('Yes'), [reason.id]: text('Lost it') }),
    );

    expect(exported.blocks).toEqual([
      { kind: 'answer', label: 'Do you have a receipt?', value: { kind: 'text', text: 'Yes' } },
    ]);
    expect(JSON.stringify(exported)).not.toContain('Lost it');
  });

  it('treats a stored answer that does not fit its field as not answered', () => {
    const name = textField('Name');
    const response = submittedResponse(template([name]), {
      [name.id]: { kind: 'number', input: '5' },
    });

    expect(toExportModel(response).blocks[0]).toMatchObject({ value: { kind: 'empty' } });
  });
});

describe('pdfFileName', () => {
  it('names the file after the form and the local time it was submitted, sortable by date', () => {
    const submittedAt = toIsoDateTime(new Date(2026, 10, 1, 9, 5));

    expect(pdfFileName({ title: 'Expense claim', submittedAt })).toBe(
      'Expense claim – response 2026-11-01 0905',
    );
  });

  it('replaces characters that file systems refuse', () => {
    const submittedAt = toIsoDateTime(new Date(2026, 10, 1, 9, 5));

    expect(pdfFileName({ title: 'Q3/Q4: travel?', submittedAt })).toBe(
      'Q3-Q4- travel- – response 2026-11-01 0905',
    );
  });
});
