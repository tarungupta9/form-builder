/**
 * The Required section of the config panel, used the way an author uses it: through the builder
 * page, finding every control by its role and accessible name.
 */
import { screen, within } from '@testing-library/react';
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
  sectionField,
  singleSelectField,
  template,
  textField,
  textareaField,
} from '../../../test/fixtures';
import { renderApp } from '../../../test/renderApp';
import { settleAnnouncements, startFakeClock } from '../../../test/timers';

function openBuilder(fields: Field[], options: Parameters<typeof renderApp>[1] = {}) {
  const form = template(fields, 'Expense claim');
  createRepositories(localStorage).templates.put(form);
  return { form, ...renderApp(`/templates/${form.id}/edit`, options) };
}

async function select(user: UserEvent, label: string) {
  const canvas = within(await screen.findByRole('list', { name: 'Fields' }));
  await user.click(canvas.getByRole('button', { name: new RegExp(`^${label}`) }));
}

const required = () => within(screen.getByRole('region', { name: 'Required' }));
const requireGroup = () => within(screen.getByRole('group', { name: 'Required conditions' }));
const unrequireGroup = () => within(screen.getByRole('group', { name: 'Not-required conditions' }));
const spoken = () => screen.getByTestId('live-region');

function storedTemplate(id: FormTemplate['id']): FormTemplate | undefined {
  const snapshot = createRepositories(localStorage).templates.snapshot();
  return snapshot.ok ? snapshot.value.get(id) : undefined;
}

describe('Required settings', () => {
  it.each<[string, Field]>([
    ['Short text', textField('Receipt number')],
    ['Long text', textareaField('Receipt number')],
    ['Number', numberField('Receipt number')],
    ['Date', dateField('Receipt number')],
    ['Single select', singleSelectField('Receipt number')],
    ['Multi select', multiSelectField('Receipt number')],
  ])('gives a %s field the Required switch and both groups', async (_type, field) => {
    const { user } = openBuilder([numberField('Amount'), field]);
    await select(user, 'Receipt number');

    expect(required().getByRole('switch', { name: 'Required' })).not.toBeChecked();
    expect(required().getByRole('button', { name: 'Add a required condition' })).toBeEnabled();
    expect(required().getByRole('button', { name: 'Add a not-required condition' })).toBeEnabled();
  });

  it('gives a section header neither the switch nor the groups', async () => {
    const { user } = openBuilder([numberField('Amount'), sectionField('Approval')]);
    await select(user, 'Approval');

    expect(screen.queryByRole('region', { name: 'Required' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Required' })).not.toBeInTheDocument();
  });

  it('never offers the field itself as a target', async () => {
    const { user } = openBuilder([numberField('Amount'), textField('Receipt number')]);
    await select(user, 'Receipt number');

    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));

    const target = requireGroup().getByRole('combobox', { name: 'Required condition 1: field' });
    expect(
      within(target)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Field 1, Amount']);
  });

  it('reads the switch and groups as one summary sentence, which describes the section', async () => {
    const { user } = openBuilder([numberField('Amount'), textField('Receipt number')]);
    await select(user, 'Receipt number');
    const section = screen.getByRole('region', { name: 'Required' });
    expect(section).toHaveAccessibleDescription('Optional.');

    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));
    expect(section).toHaveAccessibleDescription(
      'Optional, and required when all of its required conditions match.',
    );

    await user.click(required().getByRole('switch', { name: 'Required' }));
    await user.click(
      unrequireGroup().getByRole('button', { name: 'Add a not-required condition' }),
    );
    await user.selectOptions(
      unrequireGroup().getByRole('combobox', {
        name: 'Mark as not required when all of these match',
      }),
      'any',
    );
    expect(section).toHaveAccessibleDescription(
      'Required, unless any of its not-required conditions match. Required conditions win when both match.',
    );
  });

  it('saves "required when Amount is over 50" as the require group', async () => {
    const amount = numberField('Amount');
    const { form, user } = openBuilder([amount, textField('Receipt number')]);
    await select(user, 'Receipt number');

    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));
    await user.selectOptions(
      requireGroup().getByRole('combobox', { name: 'Required condition 1: operator' }),
      'is greater than',
    );
    await user.type(
      requireGroup().getByRole('textbox', { name: 'Required condition 1: value' }),
      '50',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/Last saved/);

    const saved = storedTemplate(form.id)?.fields[1];
    expect(saved?.logic).toMatchObject({
      defaultRequired: false,
      require: { match: 'all', conditions: [{ targetFieldId: amount.id }] },
    });
    expect(saved?.logic.show.conditions).toEqual([]);
    expect(screen.getByRole('button', { name: /^Receipt number/ })).toHaveAccessibleName(
      /Conditional$/,
    );
  });

  it('blocks Save for an unfinished required condition, and the issue link lands on its value', async () => {
    const { user } = openBuilder([numberField('Amount'), textField('Receipt number')]);
    await select(user, 'Receipt number');
    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const summary = await screen.findByRole('alert');
    await user.click(
      within(summary).getByRole('button', {
        name: /^Field 2, Receipt number\s?: Required condition 1: enter a number\.$/,
      }),
    );
    const value = requireGroup().getByRole('textbox', { name: 'Required condition 1: value' });
    expect(value).toHaveFocus();
    expect(value).toBeInvalid();
  });

  describe('warnings', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('warns that required conditions do nothing on a field that is already required, and announces it once', async () => {
      startFakeClock();
      const { user } = openBuilder([numberField('Amount'), textField('Receipt number')], {
        advanceTimers: vi.advanceTimersByTime,
      });
      await select(user, 'Receipt number');
      await user.click(required().getByRole('switch', { name: 'Required' }));
      const add = requireGroup().getByRole('button', { name: 'Add a required condition' });
      const warning =
        'This field is already required, so these conditions only matter if it is optional.';

      await user.click(add);
      expect(requireGroup().getByText(warning)).toBeVisible();
      expect(
        screen.getByRole('group', { name: 'Required conditions' }),
      ).toHaveAccessibleDescription(`Note: ${warning}`);
      await settleAnnouncements();
      expect(spoken()).toHaveTextContent(`Required condition 1 added. Note: ${warning}`);

      // The warning stays, so the next change says only what it did.
      await user.click(add);
      await settleAnnouncements();
      expect(spoken().textContent).toBe('Required condition 2 added');
    });

    it('warns that require wins when both groups have conditions on a required field (D-2)', async () => {
      const receipt = textField('Receipt number');
      const amount = numberField('Amount');
      receipt.logic.defaultRequired = true;
      receipt.logic.require = group(
        'all',
        condition(amount.id, { kind: 'number', op: 'gt', value: 50 }),
      );
      receipt.logic.unrequire = group(
        'all',
        condition(amount.id, { kind: 'number', op: 'lt', value: 10 }),
      );
      const { user } = openBuilder([amount, receipt]);
      await select(user, 'Receipt number');

      expect(
        requireGroup().getByText('If both match, the field is required: Mark as required wins.'),
      ).toBeVisible();
    });

    it('says nothing about warnings already there when a field is selected', async () => {
      startFakeClock();
      const receipt = textField('Receipt number');
      const amount = numberField('Amount');
      receipt.logic.unrequire = group(
        'all',
        condition(amount.id, { kind: 'number', op: 'lt', value: 10 }),
      );
      const { user } = openBuilder([amount, receipt], { advanceTimers: vi.advanceTimersByTime });

      await select(user, 'Receipt number');
      await settleAnnouncements();

      expect(unrequireGroup().getByText(/already optional/)).toBeVisible();
      expect(spoken().textContent).toBe('');
    });
  });

  it('has no axe violations with both groups filled in', async () => {
    const { user } = openBuilder([numberField('Amount'), textField('Receipt number')]);
    await select(user, 'Receipt number');
    await user.click(required().getByRole('switch', { name: 'Required' }));
    await user.click(requireGroup().getByRole('button', { name: 'Add a required condition' }));
    await user.click(
      unrequireGroup().getByRole('button', { name: 'Add a not-required condition' }),
    );

    await expectNoAxeViolations(document.body);
  });
});
