/**
 * The condition editor, used the way an author uses it: through the builder page, finding every
 * control by its role and accessible name.
 */
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { Field, FormTemplate } from '../../../domain/template';
import { createRepositories } from '../../../storage/repositories';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  condition,
  dateField,
  group,
  multiSelectField,
  numberField,
  options,
  sectionField,
  singleSelectField,
  template,
  textField,
} from '../../../test/fixtures';
import { renderApp } from '../../../test/renderApp';

function openBuilder(fields: Field[]) {
  const form = template(fields, 'Expense claim');
  createRepositories(localStorage).templates.put(form);
  return { form, ...renderApp(`/templates/${form.id}/edit`) };
}

async function select(user: UserEvent, label: string) {
  const canvas = within(await screen.findByRole('list', { name: 'Fields' }));
  await user.click(canvas.getByRole('button', { name: new RegExp(`^${label}`) }));
}

const visibility = () => within(screen.getByRole('region', { name: 'Visibility' }));
const showGroup = () => within(screen.getByRole('group', { name: 'Show conditions' }));
const hideGroup = () => within(screen.getByRole('group', { name: 'Hide conditions' }));
const optionTexts = (control: HTMLElement) =>
  within(control)
    .getAllByRole('option')
    .map((option) => option.textContent);

function storedTemplate(id: FormTemplate['id']): FormTemplate | undefined {
  const snapshot = createRepositories(localStorage).templates.snapshot();
  return snapshot.ok ? snapshot.value.get(id) : undefined;
}

/** Expense type → Nights → Approval reason, the demo chain, already saved. */
function expenseChain() {
  const type = singleSelectField('Expense type', {
    config: { options: options('Travel', 'Meals', 'Other'), display: 'radio' },
  });
  const nights = numberField('Nights');
  nights.logic.show = group(
    'any',
    condition(type.id, { kind: 'choice', op: 'equals', value: type.config.options[0]!.id }),
  );
  const reason = textField('Approval reason');
  reason.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 3 }));
  return { type, nights, reason };
}

describe('Visibility settings', () => {
  describe('target picker', () => {
    it('offers every other field that holds an answer, in form order, including fields below, but never the field itself (Q-4)', async () => {
      const { user } = openBuilder([
        textField('Purpose'),
        sectionField('Trip details'),
        textField('Note'),
        numberField('Nights'),
      ]);
      await select(user, 'Note');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      const target = showGroup().getByRole('combobox', { name: 'Show condition 1: field' });
      expect(optionTexts(target)).toEqual(['Field 1, Purpose', 'Field 4, Nights']);
      // The nearest field above is chosen first.
      expect(target).toHaveDisplayValue('Field 1, Purpose');
    });

    it('disables a field that depends on this one, and says why in visible text (D-6)', async () => {
      const { type, nights, reason } = expenseChain();
      const { user } = openBuilder([type, nights, reason]);
      await select(user, 'Expense type');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      expect(showGroup().getByRole('button', { name: 'Add a show condition' })).toBeDisabled();
      const hint =
        'Can’t choose Nights and Approval reason: they already depend on this field, so a condition on them would make a loop.';
      expect(visibility().getByText(hint)).toBeVisible();
      expect(
        screen.getByRole('button', { name: 'Add a show condition' }),
      ).toHaveAccessibleDescription(
        'Every other field already depends on this one, so a condition here would make a loop.',
      );
    });

    it('shows a disabled option’s reason in its own text, and links the hint to the select', async () => {
      const { type, nights, reason } = expenseChain();
      const purpose = textField('Purpose');
      const { user } = openBuilder([purpose, type, nights, reason]);
      await select(user, 'Expense type');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      const target = showGroup().getByRole('combobox', { name: 'Show condition 1: field' });
      const blocked = within(target).getByRole('option', {
        name: 'Field 4, Approval reason (depends on this field)',
      });
      expect(blocked).toBeDisabled();
      expect(within(target).getByRole('option', { name: 'Field 1, Purpose' })).toBeEnabled();
      expect(target).toHaveAccessibleDescription(/Can’t choose Nights and Approval reason/);
    });

    it('keeps Add disabled, with the reason, when there is no other field to read', async () => {
      const { user } = openBuilder([textField('Only field')]);
      await select(user, 'Only field');

      const add = showGroup().getByRole('button', { name: 'Add a show condition' });

      expect(add).toBeDisabled();
      expect(add).toHaveAccessibleDescription(
        'Add another field first: a condition reads another field’s answer.',
      );
    });
  });

  describe('operator and value', () => {
    it.each<[string, Field, string[]]>([
      ['Short text', textField('Target'), ['equals', 'does not equal', 'contains']],
      [
        'Number',
        numberField('Target'),
        ['equals', 'is greater than', 'is less than', 'is within range'],
      ],
      ['Single select', singleSelectField('Target'), ['equals', 'does not equal']],
      [
        'Multi select',
        multiSelectField('Target'),
        ['contains any of', 'contains all of', 'contains none of'],
      ],
      ['Date', dateField('Target'), ['equals', 'is before', 'is after']],
    ])('offers the spec’s operators for a %s target', async (_type, target, operators) => {
      const { user } = openBuilder([target, textField('Note')]);
      await select(user, 'Note');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      expect(
        optionTexts(showGroup().getByRole('combobox', { name: 'Show condition 1: operator' })),
      ).toEqual(operators);
    });

    it('lists a choice target’s options in order, after a placeholder', async () => {
      const type = singleSelectField('Expense type', {
        config: { options: options('Travel', 'Meals', 'Other'), display: 'dropdown' },
      });
      const { user } = openBuilder([type, textField('Note')]);
      await select(user, 'Note');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      expect(
        optionTexts(showGroup().getByRole('combobox', { name: 'Show condition 1: value' })),
      ).toEqual(['Choose an option', 'Travel', 'Meals', 'Other']);
    });

    it('offers a multi target’s options as labelled checkboxes', async () => {
      const types = multiSelectField('Expense types', {
        config: { options: options('Travel', 'Meals') },
      });
      const { user } = openBuilder([types, textField('Note')]);
      await select(user, 'Note');

      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      const boxes = within(showGroup().getByRole('group', { name: 'Show condition 1: options' }));
      expect(boxes.getAllByRole('checkbox').map((box) => box.parentElement?.textContent)).toEqual([
        'Travel',
        'Meals',
      ]);
    });

    it('asks for two labelled numbers for a range, keeping the number already typed', async () => {
      const { user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: value' }), '3');

      await user.selectOptions(
        showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
        'is within range',
      );

      expect(showGroup().getByRole('textbox', { name: 'Show condition 1: from' })).toHaveValue('3');
      expect(showGroup().getByRole('textbox', { name: 'Show condition 1: to' })).toHaveValue('');
    });

    it('starts the comparison again when the target changes to another kind', async () => {
      const type = singleSelectField('Expense type');
      const { user } = openBuilder([type, numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      await user.selectOptions(
        showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
        'is less than',
      );
      await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: value' }), '2');

      const target = showGroup().getByRole('combobox', { name: 'Show condition 1: field' });
      await user.selectOptions(target, 'Field 1, Expense type');

      expect(target).toHaveFocus();
      expect(
        showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
      ).toHaveDisplayValue('equals');
      expect(
        showGroup().getByRole('combobox', { name: 'Show condition 1: value' }),
      ).toHaveDisplayValue('Choose an option');
    });
  });

  describe('groups', () => {
    it('reads each group as one sentence, and changes one group’s match without the other’s', async () => {
      const { user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      await user.click(hideGroup().getByRole('button', { name: 'Add a hide condition' }));

      const showMatch = showGroup().getByRole('combobox', {
        name: 'Show this field when all of these match',
      });
      await user.selectOptions(showMatch, 'any');

      expect(showMatch).toHaveAccessibleName('Show this field when any of these match');
      expect(showMatch).toHaveAccessibleDescription(
        'All: every condition must match. Any: one is enough.',
      );
      expect(
        hideGroup().getByRole('combobox', { name: 'Hide this field when all of these match' }),
      ).toBeInTheDocument();
    });

    it('focuses and announces a new condition, and moves focus to the next one on removal', async () => {
      const { user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      const add = showGroup().getByRole('button', { name: 'Add a show condition' });
      await user.click(add);
      await user.click(add);

      const second = showGroup().getByRole('combobox', { name: 'Show condition 2: field' });
      expect(second).toHaveFocus();
      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent('Show condition 2 added');
      });

      await user.click(showGroup().getByRole('button', { name: 'Remove show condition 1' }));
      // The second condition is now the first, and has focus.
      expect(showGroup().getByRole('combobox', { name: 'Show condition 1: field' })).toHaveFocus();
      await waitFor(() => {
        expect(screen.getByTestId('live-region')).toHaveTextContent('Show condition 1 removed');
      });

      await user.click(showGroup().getByRole('button', { name: 'Remove show condition 1' }));
      expect(add).toHaveFocus();
      expect(showGroup().getByText('No conditions.')).toBeInTheDocument();
    });

    it('notes that show conditions do nothing on a field that is already visible (D-3)', async () => {
      const { user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      const note =
        'This field is already visible, so these conditions only matter if it starts hidden.';
      expect(showGroup().getByText(note)).toBeVisible();
      expect(screen.getByRole('group', { name: 'Show conditions' })).toHaveAccessibleDescription(
        `Note: ${note}`,
      );

      await user.click(visibility().getByRole('radio', { name: 'Hidden' }));

      expect(showGroup().queryByText(note)).not.toBeInTheDocument();
    });

    it('gives an input field Required and Visibility groups, and a section header Visibility only', async () => {
      const { user } = openBuilder([
        numberField('Nights'),
        textField('Note'),
        sectionField('Trip'),
      ]);
      const legends = (region: string) =>
        within(screen.getByRole('region', { name: region }))
          .getAllByRole('group')
          .map((g) => g.querySelector('legend')?.textContent);

      await select(user, 'Note');
      expect(legends('Required')).toEqual(['Required conditions', 'Not-required conditions']);
      expect(legends('Visibility')).toEqual([
        'When the form opens',
        'Show conditions',
        'Hide conditions',
      ]);

      await select(user, 'Trip');
      expect(screen.queryByRole('region', { name: 'Required' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Required' })).not.toBeInTheDocument();
      expect(legends('Visibility')).toHaveLength(3);
    });

    it('warns live that a field starting hidden with nothing showing it is never seen, without blocking Save', async () => {
      const { form, user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');

      await user.click(visibility().getByRole('radio', { name: 'Hidden' }));

      const warning = 'This field starts hidden and nothing shows it, so respondents never see it.';
      expect(visibility().getByText(warning)).toBeVisible();
      expect(
        visibility().getByRole('group', { name: 'When the form opens' }),
      ).toHaveAccessibleDescription(`Note: ${warning}`);
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText(/Last saved/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(storedTemplate(form.id)?.fields[1]?.logic.defaultVisible).toBe(false);
    });

    it('gives a section header the same visibility settings', async () => {
      const { user } = openBuilder([textField('Purpose'), sectionField('Trip details')]);
      await select(user, 'Trip details');

      expect(showGroup().getByRole('button', { name: 'Add a show condition' })).toBeEnabled();
    });
  });

  describe('saving', () => {
    it('saves the start-up visibility and the conditions, and tags the field on the canvas', async () => {
      const nights = numberField('Nights');
      const reason = textField('Approval reason');
      const { form, user } = openBuilder([nights, reason]);
      await select(user, 'Approval reason');

      await user.click(visibility().getByRole('radio', { name: 'Hidden' }));
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      await user.selectOptions(
        showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
        'is greater than',
      );
      await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: value' }), '3');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await screen.findByText(/Last saved/);

      const saved = storedTemplate(form.id)?.fields[1];
      expect(saved?.logic.defaultVisible).toBe(false);
      expect(saved?.logic.show.conditions.map((c) => [c.targetFieldId, c.predicate])).toEqual([
        [nights.id, { kind: 'number', op: 'gt', value: 3 }],
      ]);
      expect(screen.getByRole('button', { name: /^Approval reason/ })).toHaveAccessibleName(
        /Hidden at start Conditional$/,
      );
    });

    it('blocks Save for an unfinished condition, and the issue link lands on the missing value', async () => {
      const { user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));

      await user.click(screen.getByRole('button', { name: 'Save' }));

      const summary = await screen.findByRole('alert');
      const link = within(summary).getByRole('button', {
        name: /^Field 2, Note\s?: Show condition 1: enter a number\.$/,
      });
      await user.click(link);
      const value = showGroup().getByRole('textbox', { name: 'Show condition 1: value' });
      expect(value).toHaveFocus();
      expect(value).toBeInvalid();
      expect(value).toHaveAccessibleDescription('Enter a number.');
    });

    it('blocks Save when a range’s first number is more than its second (D-8)', async () => {
      const { form, user } = openBuilder([numberField('Nights'), textField('Note')]);
      await select(user, 'Note');
      await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
      await user.selectOptions(
        showGroup().getByRole('combobox', { name: 'Show condition 1: operator' }),
        'is within range',
      );
      await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: from' }), '5');
      await user.type(showGroup().getByRole('textbox', { name: 'Show condition 1: to' }), '2');

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Show condition 1: the first number is more than the second.',
      );
      expect(showGroup().getByRole('textbox', { name: 'Show condition 1: from' })).toBeInvalid();
      expect(storedTemplate(form.id)?.fields[1]?.logic.show.conditions).toEqual([]);
    });

    it('flags a stored condition whose field is missing, and blocks Save until it is fixed (D6-2)', async () => {
      // The builder removes these along with the field (D-12); only stored or hand-edited data
      // can still hold one, and it is shown, never silently dropped.
      const gone = numberField('Nights');
      const reason = textField('Approval reason');
      reason.logic.show = group('all', condition(gone.id, { kind: 'number', op: 'gt', value: 3 }));
      const { user } = openBuilder([textField('Purpose'), reason]);

      await select(user, 'Approval reason');
      const target = showGroup().getByRole('combobox', { name: 'Show condition 1: field' });
      expect(target).toHaveDisplayValue('Removed field');

      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Show condition 1: the field it reads was removed.',
      );

      await user.click(showGroup().getByRole('button', { name: 'Remove show condition 1' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  it('has no axe violations with both groups filled in and a disabled target', async () => {
    const { type, nights, reason } = expenseChain();
    const purpose = textField('Purpose');
    const { user } = openBuilder([purpose, type, nights, reason]);
    await select(user, 'Expense type');
    await user.click(showGroup().getByRole('button', { name: 'Add a show condition' }));
    await user.click(hideGroup().getByRole('button', { name: 'Add a hide condition' }));

    await expectNoAxeViolations(document.body);
  });
});
