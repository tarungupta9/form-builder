import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { createRepositories } from '../../storage/repositories';
import { template, textField } from '../../test/fixtures';
import { renderApp } from '../../test/renderApp';

const leaveDialog = () => within(screen.getByRole('dialog', { name: 'Leave without saving?' }));
const allTemplates = () => screen.getByRole('link', { name: 'All templates' });

function seedTravel() {
  const form = template([textField('Purpose')], 'Travel');
  createRepositories(localStorage).templates.put(form);
  return form;
}

async function rename(user: UserEvent, from: string, to: string) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${from}`) }));
  const label = screen.getByRole('textbox', { name: 'Label' });
  await user.clear(label);
  await user.type(label, to);
}

/** Whether a `beforeunload` now would make the browser ask before closing the tab. */
const closingTabAsks = () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }));

describe('Unsaved changes (D-21)', () => {
  it('asks before All templates takes the author away from unsaved edits', async () => {
    const form = seedTravel();
    const { user, router } = await renderApp(`/templates/${form.id}/edit`);
    await rename(user, 'Purpose', 'Reason');

    await user.click(allTemplates());

    expect(
      leaveDialog().getByText('Your changes to Travel since the last save will be lost.'),
    ).toBeVisible();
    expect(leaveDialog().getByRole('button', { name: 'Stay' })).toHaveFocus();
    expect(router.state.location.pathname).toBe(`/templates/${form.id}/edit`);
  });

  it('keeps the edits after Stay, and returns focus to the link', async () => {
    const form = seedTravel();
    const { user, router } = await renderApp(`/templates/${form.id}/edit`);
    await rename(user, 'Purpose', 'Reason');
    await user.click(allTemplates());

    await user.click(leaveDialog().getByRole('button', { name: 'Stay' }));

    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/templates/${form.id}/edit`);
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Reason');
    await waitFor(() => {
      expect(allTemplates()).toHaveFocus();
    });
  });

  it('goes home after Leave without saving, focuses its heading, and stores nothing', async () => {
    const form = seedTravel();
    const { user, router } = await renderApp(`/templates/${form.id}/edit`);
    await rename(user, 'Purpose', 'Reason');
    await user.click(allTemplates());

    await user.click(leaveDialog().getByRole('button', { name: 'Leave without saving' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Templates' })).toHaveFocus();
    });
    const stored = createRepositories(localStorage).templates.snapshot();
    expect(stored.ok && stored.value.get(form.id)?.fields[0]?.label).toBe('Purpose');
  });

  it('leaves a saved template without asking', async () => {
    const form = seedTravel();
    const { user, router } = await renderApp(`/templates/${form.id}/edit`);
    await rename(user, 'Purpose', 'Reason');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await user.click(allTemplates());

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument();
  });

  it('leaves a blank new template without asking', async () => {
    const { user, router } = await renderApp('/templates/new');

    await user.click(allTemplates());

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('moves a new template to its edit URL on its first save without asking', async () => {
    const { user, router } = await renderApp('/templates/new');
    await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Travel');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/templates\/[0-9a-f-]+\/edit$/);
    });
    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument();
  });

  it('does not count applying the details dialog unchanged as an unsaved change', async () => {
    const form = seedTravel();
    const { user, router } = await renderApp(`/templates/${form.id}/edit`);
    await user.click(screen.getByRole('button', { name: 'Edit title and description' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await user.click(allTemplates());

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('makes closing the tab ask only while there are unsaved edits', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`);
    expect(closingTabAsks()).toBe(false);

    await rename(user, 'Purpose', 'Reason');
    expect(closingTabAsks()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(closingTabAsks()).toBe(false);
  });
});
