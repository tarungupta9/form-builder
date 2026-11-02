/**
 * The v0.6 demo script (docs/implementation-plan.md), run through the real app in two parts.
 * The first builds the chain by role and label, saves it, survives a refresh and refuses a loop
 * (demo steps 1 and 5), and checks the stored conditions match `expenseChain()` below. The
 * second fills that chain in live, hears each change and submits with the chain hidden (steps
 * 2 to 4). They are split because the announcements wait in real time for typing to settle.
 *
 * jsdom cannot print, so `printDocument` is mocked and the model it is handed is checked.
 * Manual only: building the chain by keyboard alone (Tab, arrows and Space in a real browser),
 * VoiceOver reading the group sentence, the disabled options and the Fill announcements, and
 * the printed PDF itself.
 */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { FormResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import type { ExportDocument } from '../../features/export/exportModel';
import { printDocument } from '../../features/export/printDocument';
import { createRepositories } from '../../storage/repositories';
import {
  condition,
  group,
  numberField,
  options,
  singleSelectField,
  template,
  textField,
} from '../fixtures';
import { renderApp } from '../renderApp';

vi.mock('../../features/export/printDocument', () => ({ printDocument: vi.fn() }));
const print = vi.mocked(printDocument);

const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const card = (title: string) =>
  within(screen.getByRole('heading', { level: 2, name: title }).closest('li')!);
const showGroup = () => within(screen.getByRole('group', { name: 'Show conditions' }));
const spoken = () => screen.getByTestId('live-region');
const nightsBox = () => screen.queryByRole('textbox', { name: /^Nights/ });
const reasonBox = () => screen.queryByRole('textbox', { name: /^Approval reason/ });

const repositories = () => createRepositories(localStorage);

function storedTemplates(): FormTemplate[] {
  const snapshot = repositories().templates.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

function storedResponses(): FormResponse[] {
  const snapshot = repositories().responses.snapshot();
  return snapshot.ok ? [...snapshot.value.values()] : [];
}

/** The chain step 1 builds: Expense type → Nights (Travel or Meals) → Approval reason (> 3). */
function expenseChain(): FormTemplate {
  const type = singleSelectField('Expense type', {
    config: { options: options('Travel', 'Meals', 'Other'), display: 'radio' },
  });
  const [travel, meals] = type.config.options;
  const nights = numberField('Nights');
  nights.logic.defaultVisible = false;
  nights.logic.show = group(
    'any',
    condition(type.id, { kind: 'choice', op: 'equals', value: travel!.id }),
    condition(type.id, { kind: 'choice', op: 'equals', value: meals!.id }),
  );
  const reason = textField('Approval reason');
  reason.logic.defaultVisible = false;
  reason.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 3 }));
  return template([type, nights, reason], 'Expense claim');
}

/** What a template's conditions say, without the generated IDs. */
function logicOf(form: FormTemplate) {
  const labelOf = (id: string) => form.fields.find((field) => field.id === id)?.label;
  const optionLabel = (id: string | null) =>
    form.fields
      .flatMap((field) => (field.type === 'singleSelect' ? field.config.options : []))
      .find((option) => option.id === id)?.label;
  return form.fields.map(({ label, logic }) => ({
    label,
    defaultVisible: logic.defaultVisible,
    match: logic.show.match,
    show: logic.show.conditions.map(({ targetFieldId, predicate }) => [
      labelOf(targetFieldId),
      predicate.op,
      predicate.kind === 'choice' ? optionLabel(predicate.value) : predicate.value,
    ]),
  }));
}

async function addField(user: UserEvent, type: string, label: string) {
  await user.click(screen.getByRole('button', { name: `Add ${type}` }));
  await user.type(screen.getByRole('textbox', { name: 'Label' }), label);
}

async function renameOption(user: UserEvent, position: number, label: string) {
  const box = screen.getByRole('textbox', { name: `Option ${position} label` });
  await user.clear(box);
  await user.type(box, label);
}

async function startHidden(user: UserEvent) {
  const opens = within(screen.getByRole('group', { name: 'When the form opens' }));
  await user.click(opens.getByRole('radio', { name: 'Hidden' }));
}

describe('v0.6 demo: conditional visibility', () => {
  beforeEach(() => {
    print.mockResolvedValue();
  });

  it('builds the chain with an "any" group, keeps it after a refresh, and refuses a loop (steps 1 and 5)', async () => {
    const { user, unmount } = renderApp('/templates/new');

    await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
    const details = within(screen.getByRole('dialog', { name: 'Title and description' }));
    await user.type(details.getByRole('textbox', { name: 'Title' }), 'Expense claim');
    await user.click(details.getByRole('button', { name: 'Done' }));

    await addField(user, 'Single select', 'Expense type');
    await renameOption(user, 1, 'Travel');
    await renameOption(user, 2, 'Meals');
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await renameOption(user, 3, 'Other');

    await addField(user, 'Number', 'Nights');
    await startHidden(user);
    const addShow = showGroup().getByRole('button', { name: 'Add a show condition' });
    await user.click(addShow);
    await user.selectOptions(
      showGroup().getByRole('combobox', { name: 'Show condition 1: value' }),
      'Travel',
    );
    await user.click(addShow);
    await user.selectOptions(
      showGroup().getByRole('combobox', { name: 'Show condition 2: value' }),
      'Meals',
    );
    await user.selectOptions(
      showGroup().getByRole('combobox', { name: 'Show this field when all of these match' }),
      'any',
    );

    await addField(user, 'Short text', 'Approval reason');
    await startHidden(user);
    await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
    expect(
      showGroup().getByRole('combobox', { name: 'Show condition 1: field' }),
    ).toHaveDisplayValue('Field 2, Nights');
    await user.selectOptions(
      showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
      'is greater than',
    );
    await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: value' }), '3');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    // What was saved is exactly the chain the fill test below runs on.
    const [saved] = storedTemplates();
    expect(logicOf(saved!)).toEqual(logicOf(expenseChain()));

    // A full refresh keeps the conditions: the canvas tags both dependants.
    unmount();
    const { user: author } = renderApp('/');
    await author.click(
      await card('Expense claim').findByRole('link', { name: /^Open in builder/ }),
    );
    for (const label of [/^Nights/, /^Approval reason/]) {
      expect(await canvas().findByRole('button', { name: label })).toHaveAccessibleName(
        /Hidden at start Conditional$/,
      );
    }

    // Step 5: Expense type may not read Nights or Approval reason, and the reason is on screen.
    await author.click(canvas().getByRole('button', { name: /^Expense type/ }));
    expect(showGroup().getByRole('button', { name: 'Add a show condition' })).toBeDisabled();
    expect(
      screen.getByText(
        'Can’t choose Nights and Approval reason: they already depend on this field, so a condition on them would make a loop.',
      ),
    ).toBeVisible();
  });

  it('shows and hides the chain live, announces each change, and submits without the hidden fields (steps 2 to 4)', async () => {
    const form = expenseChain();
    repositories().templates.put(form);
    const { user } = renderApp('/');
    await user.click(await card('Expense claim').findByRole('link', { name: /^New response/ }));

    // 2. Only Expense type shows. Travel shows Nights; 4 nights shows Approval reason.
    await user.click(await screen.findByRole('radio', { name: 'Travel' }));
    expect(reasonBox()).not.toBeInTheDocument();
    await waitFor(() => {
      expect(spoken()).toHaveTextContent('Nights shown.');
    });
    await user.type(nightsBox()!, '4');
    await waitFor(() => {
      expect(spoken()).toHaveTextContent('Approval reason shown.');
    });
    await user.type(reasonBox()!, 'Client workshop');

    // 3. Other hides both, and says their answers won't be submitted. Travel brings them back.
    await user.click(screen.getByRole('radio', { name: 'Other' }));
    expect(nightsBox()).not.toBeInTheDocument();
    expect(reasonBox()).not.toBeInTheDocument();
    await waitFor(() => {
      expect(spoken()).toHaveTextContent(
        'Nights and Approval reason hidden. Answers in hidden fields won’t be submitted.',
      );
    });
    await user.click(screen.getByRole('radio', { name: 'Travel' }));
    expect(nightsBox()).toHaveValue('4');
    expect(reasonBox()).toHaveValue('Client workshop');

    // 4. Submit with both hidden: neither the stored record nor the PDF holds them.
    await user.click(screen.getByRole('radio', { name: 'Other' }));
    await user.click(screen.getByRole('button', { name: 'Submit response' }));
    await screen.findByRole('heading', { name: 'Response submitted' });
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    const [response] = storedResponses();
    expect(
      response?.status === 'submitted' && response.snapshot.fields.map((f) => f.label),
    ).toEqual(['Expense type']);
    expect(response?.status === 'submitted' && Object.keys(response.answers)).toHaveLength(1);
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1);
    });
    const printed: ExportDocument = print.mock.lastCall![0];
    expect(printed).toMatchObject({
      title: 'Expense claim',
      blocks: [{ label: 'Expense type', value: { kind: 'text', text: 'Other' } }],
    });
    expect(printed.blocks).toHaveLength(1);
  });
});
