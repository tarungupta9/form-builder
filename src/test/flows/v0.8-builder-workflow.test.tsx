/**
 * The v0.8 demo script (docs/implementation-plan.md), run through the real app. It seeds
 * "Travel" (Purpose, Amount, Notes) with 2 submitted responses, then: reorders by keyboard drag
 * and by the Move buttons, saves and refreshes, previews an unsaved rename and submits it
 * without storing anything, is stopped by the unsaved-changes guard, and deletes the template
 * with its responses. A second part saves over another tab's save. Announcements run on a fake
 * clock (`test/timers.ts`) and list items are given a layout (`test/layout.ts`), so the keyboard
 * drag can find its neighbours in jsdom.
 *
 * Manual only, in Chrome and Safari: dragging with the mouse, dragging a palette button onto
 * the canvas, VoiceOver reading the drag instructions and both live regions (dnd-kit's during a
 * drag, the dialog's own in Preview), the browser's prompt when closing the tab with unsaved
 * edits, and the modals' real focus trap (jsdom's `showModal` stand-in leaves the page behind
 * them reachable).
 */
import { act, screen, waitFor, within } from '@testing-library/react';
import { toIsoDateTime } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { STORAGE_KEYS, createRepositories } from '../../storage/repositories';
import { numberField, submittedResponse, template, textField, textareaField } from '../fixtures';
import { stubListLayout } from '../layout';
import { renderApp } from '../renderApp';
import { FLOW_TIMEOUT_MS, settleAnnouncements, startFakeClock } from '../timers';

const repositories = () => createRepositories(localStorage);
const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const order = () =>
  canvas()
    .getAllByRole('button', { name: /^Reorder / })
    .map((handle) => handle.getAttribute('aria-label')?.replace('Reorder ', ''));
const spoken = () => screen.getByTestId('live-region');
const dragStatus = () =>
  screen.getAllByRole('status').find((region) => region.id.startsWith('DndLiveRegion'));
const storedKeys = () =>
  Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));

function stored() {
  const templates = repositories().templates.snapshot();
  const responses = repositories().responses.snapshot();
  return {
    templates: templates.ok ? [...templates.value.values()] : [],
    responses: responses.ok ? [...responses.value.values()] : [],
  };
}

function seedTravel(): FormTemplate {
  const form = template(
    [textField('Purpose'), numberField('Amount'), textareaField('Notes')],
    'Travel',
  );
  repositories().templates.put(form);
  repositories().responses.put(submittedResponse(form));
  repositories().responses.put(submittedResponse(form));
  return form;
}

describe('v0.8 demo: builder workflow', { timeout: FLOW_TIMEOUT_MS }, () => {
  beforeEach(() => {
    startFakeClock();
    stubListLayout();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reorders, saves, previews, guards unsaved edits and deletes the template with its responses', async () => {
    const form = seedTravel();
    const first = await renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    const { user } = first;

    // 1. Keyboard reorder: Amount to the top.
    canvas().getByRole('button', { name: 'Reorder Amount' }).focus();
    await user.keyboard(' ');
    await waitFor(() => {
      expect(dragStatus()).toHaveTextContent('Picked up Amount, position 2 of 3.');
    });
    await user.keyboard('{ArrowUp}');
    await user.keyboard(' ');
    await waitFor(() => {
      expect(order()).toEqual(['Amount', 'Purpose', 'Notes']);
    });
    expect(dragStatus()).toHaveTextContent('Amount dropped at position 1 of 3.');

    // 2. The Move buttons put it back.
    await user.click(canvas().getByRole('button', { name: 'Move Amount down' }));
    expect(order()).toEqual(['Purpose', 'Amount', 'Notes']);
    await settleAnnouncements();
    expect(spoken()).toHaveTextContent('Amount moved to position 2 of 3');

    // 3. Save and refresh keeps the order: Amount to the bottom first, so there is a change.
    await user.click(canvas().getByRole('button', { name: 'Move Amount down' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    first.unmount();
    const second = await renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    expect(order()).toEqual(['Purpose', 'Notes', 'Amount']);

    // 4. Preview an unsaved rename; submitting it stores nothing.
    await second.user.click(canvas().getByRole('button', { name: /^Notes/ }));
    const label = screen.getByRole('textbox', { name: 'Label' });
    await second.user.clear(label);
    await second.user.type(label, 'Comments');
    const before = storedKeys();
    await second.user.click(screen.getByRole('button', { name: 'Preview' }));
    const preview = within(screen.getByRole('dialog', { name: 'Preview: Travel' }));
    expect(preview.getByRole('textbox', { name: /^Comments/ })).toBeInTheDocument();
    await second.user.click(preview.getByRole('button', { name: 'Submit response' }));
    expect(await preview.findByText(/Nothing was saved/)).toBeVisible();
    expect(storedKeys()).toEqual(before);
    expect(stored().responses).toHaveLength(2);
    await second.user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Preview' })).toHaveFocus();
    });

    // 5. The guard: Stay, then Leave without saving.
    await second.user.click(screen.getByRole('link', { name: 'All templates' }));
    const leave = () => within(screen.getByRole('dialog', { name: 'Leave without saving?' }));
    await second.user.click(leave().getByRole('button', { name: 'Stay' }));
    expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Comments');
    await second.user.click(screen.getByRole('link', { name: 'All templates' }));
    await second.user.click(leave().getByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Templates' })).toBeVisible();

    // 6. Delete Travel and its 2 responses.
    await second.user.click(screen.getByRole('button', { name: /^Delete\s*: Travel$/ }));
    const confirm = within(screen.getByRole('dialog', { name: 'Delete Travel?' }));
    expect(confirm.getByText(/Its 2 responses will be deleted too/)).toBeVisible();
    await second.user.click(
      confirm.getByRole('button', { name: 'Delete template and 2 responses' }),
    );

    expect(stored()).toEqual({ templates: [], responses: [] });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create your first template' })).toHaveFocus();
    });
    await settleAnnouncements();
    expect(spoken()).toHaveTextContent('Deleted Travel and its 2 responses.');
  });

  it('warns on Save when another tab saved in the meantime, and Replace keeps these edits', async () => {
    const form = seedTravel();
    const { user } = await renderApp(`/templates/${form.id}/edit`, {
      advanceTimers: vi.advanceTimersByTime,
    });
    await user.click(canvas().getByRole('button', { name: 'Move Notes up' }));

    // Another tab saves first.
    repositories().templates.put({
      ...form,
      title: 'Travel (theirs)',
      updatedAt: toIsoDateTime(new Date('2026-11-02T08:00:00Z')),
    });
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.templates }));
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    const warning = within(
      screen.getByRole('dialog', { name: 'This template changed in another tab' }),
    );
    await user.click(warning.getByRole('button', { name: 'Replace with my version' }));

    const [saved] = stored().templates;
    expect(saved?.title).toBe('Travel');
    expect(saved?.fields.map((field) => field.label)).toEqual(['Purpose', 'Notes', 'Amount']);
  });
});
