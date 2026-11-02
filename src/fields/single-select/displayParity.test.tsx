/**
 * The AGENTS.md invariant: single select's selection and required validation behave
 * identically across radio, dropdown and tiles. Each display is run through the real Fill page
 * with the same scenario, and every assertion compares against one shared expectation, so a
 * display that drifts (another message, another focus target, another stored value) goes red.
 *
 * Arrow-key movement inside the radio and tile groups is the browser's own and jsdom does not
 * simulate it; it is in the manual keyboard and VoiceOver demo instead.
 */
import { screen, waitFor } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { FieldValue, FormResponse } from '../../domain/response';
import type { SingleSelectDisplay } from '../../domain/template';
import { controlIdOf } from '../../features/fill/FillField';
import { createRepositories } from '../../storage/repositories';
import { singleSelectField, template } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

const ERROR = 'Choose an option for Payment method';

/** Every stored answer of every submitted response. */
function storedAnswers(): (FieldValue | undefined)[] {
  const snapshot = createRepositories(localStorage).responses.snapshot();
  const responses: FormResponse[] = snapshot.ok ? [...snapshot.value.values()] : [];
  return responses.flatMap((response) =>
    response.status === 'submitted' ? Object.values(response.answers) : [],
  );
}

/** Opens a new response to a form whose only field is a Payment method single select. */
async function openForm(display: SingleSelectDisplay, required: boolean) {
  const base = singleSelectField('Payment method');
  const field = {
    ...base,
    config: { ...base.config, display },
    logic: { ...base.logic, defaultRequired: required },
  };
  const form = template([field]);
  createRepositories(localStorage).templates.put(form);
  const app = await renderApp(`/templates/${form.id}/respond`);
  const cash = field.config.options[1]!;
  return { ...app, field, cash };
}

/** Picks an option the way a respondent does with each display. */
async function choose(user: UserEvent, display: SingleSelectDisplay, label: string) {
  if (display === 'dropdown') {
    await user.selectOptions(screen.getByRole('combobox', { name: /Payment method/ }), label);
  } else {
    await user.click(screen.getByRole('radio', { name: label }));
  }
}

/** Takes the answer back to "none" the way each display offers it (O-15). */
async function clear(user: UserEvent, display: SingleSelectDisplay) {
  if (display === 'dropdown') {
    await choose(user, display, 'Choose an option');
  } else {
    await user.click(screen.getByRole('button', { name: 'Clear answer' }));
  }
}

const submit = (user: UserEvent) =>
  user.click(screen.getByRole('button', { name: 'Submit response' }));

describe.each<SingleSelectDisplay>(['radio', 'dropdown', 'tiles'])(
  'Single select shown as %s',
  (display) => {
    it('blocks an empty required answer with the shared message and focus target', async () => {
      const { user, field } = await openForm(display, true);
      await screen.findByRole('button', { name: 'Submit response' });

      await submit(user);

      const summary = await screen.findByRole('alert');
      await waitFor(() => {
        expect(summary).toHaveFocus();
      });
      expect(summary).toHaveTextContent(`Fix 1 problem before submitting${ERROR}`);
      // The inline error under the field reads the same as the summary entry.
      expect(screen.getAllByText(ERROR)).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: ERROR }));
      // The first radio, or the select: either way the control the field's ID names.
      const focused = document.activeElement;
      expect(focused).toHaveAttribute('id', controlIdOf(field.id));
      expect(focused).toHaveRole(display === 'dropdown' ? 'combobox' : 'radio');
      expect(focused).toBeRequired();
      expect(storedAnswers()).toEqual([]);
    });

    it('clears the error once an option is chosen and stores the option’s ID', async () => {
      const { user, cash } = await openForm(display, true);
      await screen.findByRole('button', { name: 'Submit response' });
      await submit(user);
      await screen.findByRole('alert');

      await choose(user, display, 'Cash');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(ERROR)).not.toBeInTheDocument();

      await submit(user);
      await screen.findByRole('heading', { name: 'Response submitted' });
      expect(storedAnswers()).toEqual([{ kind: 'choice', value: cash.id }]);
    });

    it('stores no answer for an optional field chosen and then cleared', async () => {
      const { user } = await openForm(display, false);
      await screen.findByRole('button', { name: 'Submit response' });

      await choose(user, display, 'Cash');
      await clear(user, display);
      await submit(user);

      await screen.findByRole('heading', { name: 'Response submitted' });
      expect(storedAnswers()).toEqual([]);
    });
  },
);
