import { act, screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { toIsoDateTime } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { template, textField } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

const repositories = () => createRepositories(localStorage);
const conflictDialog = () =>
  within(screen.getByRole('dialog', { name: 'This template changed in another tab' }));
const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));

function stored(id: FormTemplate['id']): FormTemplate | undefined {
  const snapshot = repositories().templates.snapshot();
  return snapshot.ok ? snapshot.value.get(id) : undefined;
}

function seedTravel() {
  const form = template([textField('Purpose')], 'Travel');
  repositories().templates.put(form);
  return form;
}

/** What another tab does: writes to storage, and this tab hears a `storage` event for the key. */
function anotherTab(change: () => void) {
  change();
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.templates }));
  });
}

function savedElsewhere(form: FormTemplate, label: string): FormTemplate {
  const theirs: FormTemplate = {
    ...form,
    fields: [textField(label)],
    updatedAt: toIsoDateTime(new Date('2026-11-02T08:00:00Z')),
  };
  anotherTab(() => repositories().templates.put(theirs));
  return theirs;
}

async function addNotes(user: UserEvent) {
  await user.click(screen.getByRole('button', { name: 'Add Short text' }));
  await user.type(screen.getByRole('textbox', { name: 'Label' }), 'Notes');
}

const save = (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Save' }));

describe('Saving after another tab changed the template (HLD §4.5)', () => {
  it('saves without a warning when nothing else saved', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await addNotes(user);

    await save(user);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored(form.id)?.fields).toHaveLength(2);
  });

  it('warns when another tab saved after this one opened, and Cancel writes nothing', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await addNotes(user);
    const theirs = savedElsewhere(form, 'Destination');

    await save(user);

    expect(conflictDialog().getByText(/It was saved in another tab at/)).toBeVisible();
    expect(conflictDialog().getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(conflictDialog().getByRole('button', { name: 'Cancel' }));

    expect(stored(form.id)).toEqual(theirs);
    expect(canvas().getByRole('button', { name: /^Notes/ })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    });
  });

  it('stores these edits after Replace with my version, and the next save does not warn', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await addNotes(user);
    savedElsewhere(form, 'Destination');
    await save(user);

    await user.click(conflictDialog().getByRole('button', { name: 'Replace with my version' }));

    expect(stored(form.id)?.fields.map((field) => field.label)).toEqual(['Purpose', 'Notes']);
    await user.type(screen.getByRole('textbox', { name: 'Label' }), ' 2');
    await save(user);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stored(form.id)?.fields[1]?.label).toBe('Notes 2');
  });

  it('loads the other tab’s version after Use their version, discarding these edits', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await addNotes(user);
    const theirs = savedElsewhere(form, 'Destination');
    await save(user);

    await user.click(conflictDialog().getByRole('button', { name: 'Use their version' }));

    expect(canvas().getByRole('button', { name: /^Destination/ })).toBeInTheDocument();
    expect(canvas().queryByRole('button', { name: /^Notes/ })).not.toBeInTheDocument();
    expect(screen.getByText('Select a field to change its settings.')).toBeVisible();
    expect(stored(form.id)).toEqual(theirs);
  });

  it('keeps a template deleted in another tab open, and Save offers to save it again', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    await addNotes(user);
    anotherTab(() => repositories().templates.remove([form.id]));

    expect(canvas().getByRole('button', { name: /^Notes/ })).toBeInTheDocument();
    await save(user);
    const dialog = within(
      screen.getByRole('dialog', { name: 'This template was deleted in another tab' }),
    );
    await user.click(dialog.getByRole('button', { name: 'Save again' }));

    expect(stored(form.id)?.fields.map((field) => field.label)).toEqual(['Purpose', 'Notes']);
  });
});
