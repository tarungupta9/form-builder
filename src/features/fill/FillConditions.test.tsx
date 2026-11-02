/**
 * Conditional visibility as a respondent meets it in Fill mode: fields appear and disappear as
 * they answer, and a hidden field is neither validated nor submitted (AGENTS.md invariants).
 */
import { screen, waitFor, within } from '@testing-library/react';
import type { FormResponse } from '../../domain/response';
import type { FormTemplate, SingleSelectDisplay } from '../../domain/template';
import { createRepositories } from '../../storage/repositories';
import {
  condition,
  group,
  numberField,
  options,
  singleSelectField,
  template,
  textField,
} from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';
import type { ExportDocument } from '../export/exportModel';
import { printDocument } from '../export/printDocument';

vi.mock('../export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

function storedResponses(): FormResponse[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

/** Expense type → Nights (Travel only, required) → Approval reason (over 3 nights). */
function expenseClaim(display: SingleSelectDisplay = 'radio') {
  const type = singleSelectField('Expense type', {
    config: { options: options('Travel', 'Meals', 'Other'), display },
  });
  const [travel] = type.config.options;
  const nights = numberField('Nights');
  nights.logic.defaultVisible = false;
  nights.logic.defaultRequired = true;
  nights.logic.show = group(
    'all',
    condition(type.id, { kind: 'choice', op: 'equals', value: travel!.id }),
  );
  const reason = textField('Approval reason');
  reason.logic.defaultVisible = false;
  reason.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 3 }));
  const form: FormTemplate = template([type, nights, reason], 'Expense claim');
  createRepositories(localStorage).templates.put(form);
  return { form, type, nights, reason };
}

const nightsBox = () => screen.queryByRole('textbox', { name: /^Nights/ });
const reasonBox = () => screen.queryByRole('textbox', { name: /^Approval reason/ });

describe('Fill: conditional visibility', () => {
  beforeEach(() => {
    print.mockResolvedValue();
  });

  it('shows Approval reason as soon as Nights goes above 3, before blur or submit', async () => {
    const { form } = expenseClaim();
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('radio', { name: 'Travel' }));

    const nights = nightsBox()!;
    await user.type(nights, '3');
    expect(reasonBox()).not.toBeInTheDocument();
    await user.type(nights, '{Backspace}4');

    expect(reasonBox()).toBeInTheDocument();
    expect(nights).toHaveFocus();
  });

  it('restores the typed value when a hidden field is shown again (D-9)', async () => {
    const { form } = expenseClaim();
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('radio', { name: 'Travel' }));
    await user.type(nightsBox()!, '5');
    await user.type(reasonBox()!, 'Client visit');

    await user.click(screen.getByRole('radio', { name: 'Other' }));
    expect(nightsBox()).not.toBeInTheDocument();
    expect(reasonBox()).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Travel' }));

    expect(nightsBox()).toHaveValue('5');
    expect(reasonBox()).toHaveValue('Client visit');
  });

  it('submits when a required field is hidden by a condition', async () => {
    const { form } = expenseClaim();
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('radio', { name: 'Travel' }));
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a number for Nights');

    await user.click(screen.getByRole('radio', { name: 'Meals' }));
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    expect(await screen.findByRole('heading', { name: 'Response submitted' })).toBeVisible();
    expect(storedResponses()).toHaveLength(1);
  });

  it('leaves a field hidden by a condition out of the stored record and the PDF', async () => {
    const { form, type, nights, reason } = expenseClaim();
    const { user } = renderApp(`/templates/${form.id}/respond`);
    await user.click(await screen.findByRole('radio', { name: 'Travel' }));
    await user.type(nightsBox()!, '4');
    await user.type(reasonBox()!, 'Client visit');
    await user.click(screen.getByRole('radio', { name: 'Other' }));

    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    const [stored] = storedResponses();
    expect(stored?.status === 'submitted' && Object.keys(stored.answers)).toEqual([type.id]);
    expect(stored?.status === 'submitted' && stored.snapshot.fields.map((f) => f.id)).toEqual([
      type.id,
    ]);
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1);
    });
    const printed: ExportDocument = print.mock.lastCall![0];
    expect(printed.blocks.map((block) => block.kind === 'answer' && block.label)).toEqual([
      'Expense type',
    ]);
    expect(JSON.stringify(printed)).not.toContain(nights.id);
    expect(JSON.stringify(printed)).not.toContain(reason.label);
  });

  it('keeps a field hidden while the single select it reads is unanswered, even for "does not equal" (D-4)', async () => {
    const payment = singleSelectField('Payment', {
      config: { options: options('Card', 'Cash'), display: 'radio' },
    });
    const receipt = textField('Receipt number');
    receipt.logic.defaultVisible = false;
    receipt.logic.show = group(
      'all',
      condition(payment.id, {
        kind: 'choice',
        op: 'notEquals',
        value: payment.config.options[0]!.id,
      }),
    );
    const form = template([payment, receipt], 'Expense claim');
    createRepositories(localStorage).templates.put(form);
    const { user } = renderApp(`/templates/${form.id}/respond`);

    await screen.findByRole('radio', { name: 'Card' });
    expect(screen.queryByRole('textbox', { name: 'Receipt number' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Cash' }));

    expect(screen.getByRole('textbox', { name: 'Receipt number' })).toBeInTheDocument();
  });

  it.each<SingleSelectDisplay>(['radio', 'dropdown', 'tiles'])(
    'shows the dependent field when Travel is chosen from %s, the same way for every display',
    async (display) => {
      const { form } = expenseClaim(display);
      const { user } = renderApp(`/templates/${form.id}/respond`);

      if (display === 'dropdown') {
        await user.selectOptions(
          await screen.findByRole('combobox', { name: 'Expense type' }),
          'Travel',
        );
      } else {
        const choices = within(await screen.findByRole('group', { name: 'Expense type' }));
        await user.click(choices.getByRole('radio', { name: 'Travel' }));
      }

      expect(nightsBox()).toBeInTheDocument();
    },
  );
});
