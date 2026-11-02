import { screen, waitFor, within } from '@testing-library/react';
import type { FormTemplate } from '../../domain/template';
import { createRepositories } from '../../storage/repositories';
import { numberField, template, textField, textareaField } from '../../test/fixtures';
import { stubListLayout } from '../../test/layout';
import { renderApp } from '../../test/renderApp';
import { settleAnnouncements, startFakeClock } from '../../test/timers';

const canvas = () => within(screen.getByRole('list', { name: 'Fields' }));
const order = () =>
  canvas()
    .getAllByRole('button', { name: /^Reorder / })
    .map((handle) => handle.getAttribute('aria-label')?.replace('Reorder ', ''));
const spoken = () => screen.getByTestId('live-region');
/** dnd-kit's own live region, which speaks the drag (D8-2). */
const dragStatus = () =>
  screen.getAllByRole('status').find((region) => region.id.startsWith('DndLiveRegion'));

function seedTravel(): FormTemplate {
  const form = template(
    [textField('Purpose'), numberField('Amount'), textareaField('Notes')],
    'Travel',
  );
  createRepositories(localStorage).templates.put(form);
  return form;
}

describe('Reordering fields', () => {
  describe('with the Move buttons', () => {
    it('disables Move up on the first field and Move down on the last', async () => {
      const form = seedTravel();
      await renderApp(`/templates/${form.id}/edit`);

      expect(canvas().getByRole('button', { name: 'Move Purpose up' })).toBeDisabled();
      expect(canvas().getByRole('button', { name: 'Move Purpose down' })).toBeEnabled();
      expect(canvas().getByRole('button', { name: 'Move Notes up' })).toBeEnabled();
      expect(canvas().getByRole('button', { name: 'Move Notes down' })).toBeDisabled();
    });

    it('moves a field down, says where it went, and keeps focus on Move down', async () => {
      startFakeClock();
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`, {
        advanceTimers: vi.advanceTimersByTime,
      });

      await user.click(canvas().getByRole('button', { name: 'Move Purpose down' }));

      expect(order()).toEqual(['Amount', 'Purpose', 'Notes']);
      await waitFor(() => {
        expect(canvas().getByRole('button', { name: 'Move Purpose down' })).toHaveFocus();
      });
      await settleAnnouncements();
      expect(spoken()).toHaveTextContent('Purpose moved to position 2 of 3');
      vi.useRealTimers();
    });

    it('hands focus to Move down when a field reaches the top, where Move up is disabled', async () => {
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`);

      await user.click(canvas().getByRole('button', { name: 'Move Amount up' }));

      expect(order()).toEqual(['Amount', 'Purpose', 'Notes']);
      expect(canvas().getByRole('button', { name: 'Move Amount up' })).toBeDisabled();
      await waitFor(() => {
        expect(canvas().getByRole('button', { name: 'Move Amount down' })).toHaveFocus();
      });
    });

    it('keeps the selected field selected after moving it', async () => {
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`);
      await user.click(canvas().getByRole('button', { name: /^Notes/ }));

      await user.click(canvas().getByRole('button', { name: 'Move Notes up' }));

      expect(canvas().getByRole('button', { name: /^Notes/, pressed: true })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue('Notes');
    });

    it('saves the new order', async () => {
      const form = seedTravel();
      const { user, unmount } = await renderApp(`/templates/${form.id}/edit`);
      await user.click(canvas().getByRole('button', { name: 'Move Notes up' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      unmount();
      await renderApp(`/templates/${form.id}/edit`);
      expect(order()).toEqual(['Purpose', 'Notes', 'Amount']);
    });
  });

  describe('by keyboard drag', () => {
    beforeEach(() => {
      stubListLayout();
    });

    it('moves a field down one with Space, ArrowDown, Space, and the drag status says where it landed', async () => {
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`);
      const handle = canvas().getByRole('button', { name: 'Reorder Purpose' });
      handle.focus();

      await user.keyboard(' ');
      await waitFor(() => {
        expect(dragStatus()).toHaveTextContent('Picked up Purpose, position 1 of 3.');
      });
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(dragStatus()).toHaveTextContent('Purpose is over position 2 of 3.');
      });
      await user.keyboard(' ');

      await waitFor(() => {
        expect(order()).toEqual(['Amount', 'Purpose', 'Notes']);
      });
      expect(dragStatus()).toHaveTextContent('Purpose dropped at position 2 of 3.');
      // The drop is spoken by dnd-kit's region only, never by the app's as well.
      expect(spoken()).not.toHaveTextContent('Purpose');
      await waitFor(() => {
        expect(canvas().getByRole('button', { name: 'Reorder Purpose' })).toHaveFocus();
      });
    });

    it('leaves the order alone when Escape cancels a drag', async () => {
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`);
      canvas().getByRole('button', { name: 'Reorder Purpose' }).focus();

      await user.keyboard(' ');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(dragStatus()).toHaveTextContent('Reorder cancelled. Purpose is back at position 1.');
      });
      expect(order()).toEqual(['Purpose', 'Amount', 'Notes']);
    });

    it('describes the handle with the keyboard instructions', async () => {
      const form = seedTravel();
      await renderApp(`/templates/${form.id}/edit`);

      expect(canvas().getByRole('button', { name: 'Reorder Purpose' })).toHaveAccessibleDescription(
        /Press Space to pick up the field.*Move up and Move down buttons/,
      );
    });

    it('still adds a field when Enter is pressed on a palette button, rather than starting a drag', async () => {
      const form = seedTravel();
      const { user } = await renderApp(`/templates/${form.id}/edit`);
      screen.getByRole('button', { name: 'Add Short text' }).focus();

      await user.keyboard('{Enter}');

      expect(order()).toEqual(['Purpose', 'Amount', 'Notes', 'Untitled field']);
      expect(dragStatus()?.textContent ?? '').toBe('');
    });
  });
});
