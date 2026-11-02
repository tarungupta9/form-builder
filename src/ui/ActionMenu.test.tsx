import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { expectNoAxeViolations } from '../test/axe';
import { ActionMenu, type ActionMenuItem } from './ActionMenu';

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderMenu(onDelete = vi.fn()) {
  const items: ActionMenuItem[] = [
    { kind: 'link', label: 'Open in builder', to: '/edit', icon: 'edit' },
    { kind: 'link', label: 'View responses', to: '/responses', icon: 'file' },
    { kind: 'separator' },
    { kind: 'action', label: 'Delete', icon: 'trash', tone: 'danger', onSelect: onDelete },
  ];
  const user = userEvent.setup();
  const view = render(
    <MemoryRouter initialEntries={['/']}>
      <ActionMenu label="More actions for Travel" items={items} />
      <button type="button">Next control</button>
      <Routes>
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
  const trigger = screen.getByRole('button', { name: 'More actions for Travel' });
  const menu = () => screen.queryByRole('menu', { name: 'More actions for Travel' });
  const item = (name: string) => within(menu()!).getByRole('menuitem', { name });
  return { ...view, user, trigger, menu, item, onDelete };
}

describe('ActionMenu', () => {
  it('starts closed, and reports that it opens a menu', () => {
    const { trigger, menu } = renderMenu();

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(menu()).not.toBeInTheDocument();
  });

  it('opens on click, lists its items in order, and focuses the first', async () => {
    const { user, trigger, menu, item } = renderMenu();

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', menu()!.id);
    const names = within(menu()!)
      .getAllByRole('menuitem')
      .map((entry) => entry.textContent);
    expect(names).toEqual(['Open in builder', 'View responses', 'Delete']);
    expect(within(menu()!).getByRole('separator')).toBeInTheDocument();
    expect(item('Open in builder')).toHaveFocus();
  });

  it('closes when the trigger is clicked again, leaving focus on the trigger', async () => {
    const { user, trigger, menu } = renderMenu();

    await user.click(trigger);
    await user.click(trigger);

    expect(menu()).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('opens with ArrowDown on the first item, and with ArrowUp on the last', async () => {
    const { user, trigger, item } = renderMenu();
    trigger.focus();

    await user.keyboard('{ArrowDown}');
    expect(item('Open in builder')).toHaveFocus();

    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
  });

  it('opens with Enter or Space on the first item', async () => {
    const { user, trigger, item } = renderMenu();
    trigger.focus();

    await user.keyboard('{Enter}');
    expect(item('Open in builder')).toHaveFocus();

    await user.keyboard('{Escape}');
    await user.keyboard(' ');
    expect(item('Open in builder')).toHaveFocus();
  });

  it('moves between items with the arrows, wrapping at either end, skipping the separator', async () => {
    const { user, trigger, item } = renderMenu();
    await user.click(trigger);

    await user.keyboard('{ArrowDown}');
    expect(item('View responses')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Delete')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(item('Open in builder')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(item('Delete')).toHaveFocus();
  });

  it('jumps to the first and last items with Home and End', async () => {
    const { user, trigger, item } = renderMenu();
    await user.click(trigger);

    await user.keyboard('{End}');
    expect(item('Delete')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(item('Open in builder')).toHaveFocus();
  });

  it('keeps every item out of the Tab order, so the open menu is one stop', async () => {
    const { user, trigger, menu } = renderMenu();
    await user.click(trigger);

    for (const entry of within(menu()!).getAllByRole('menuitem')) {
      expect(entry).toHaveAttribute('tabindex', '-1');
    }
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user, trigger, menu } = renderMenu();
    await user.click(trigger);

    await user.keyboard('{Escape}');

    expect(menu()).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on Tab and lets focus move on to the next control', async () => {
    const { user, trigger, menu } = renderMenu();
    await user.click(trigger);

    await user.tab();

    expect(menu()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next control' })).toHaveFocus();
  });

  it('closes when the user clicks outside it', async () => {
    const { user, trigger, menu } = renderMenu();
    await user.click(trigger);

    await user.click(document.body);

    expect(menu()).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('runs an action, closing the menu with focus already back on the trigger', async () => {
    const onDelete = vi.fn(() => {
      // What a dialog opened here would record as the element to return focus to.
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'More actions for Travel' }),
      );
    });
    const { user, trigger, menu, item } = renderMenu(onDelete);
    await user.click(trigger);

    await user.click(item('Delete'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(menu()).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('runs an action chosen from the keyboard with Enter', async () => {
    const { user, trigger, onDelete } = renderMenu();
    trigger.focus();

    await user.keyboard('{ArrowUp}{Enter}');

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('follows a link item client-side, by click or by Space, and closes', async () => {
    const { user, trigger, menu, item } = renderMenu();

    await user.click(trigger);
    await user.click(item('Open in builder'));
    expect(screen.getByTestId('path')).toHaveTextContent('/edit');
    expect(menu()).not.toBeInTheDocument();

    await user.click(trigger);
    await user.keyboard('{ArrowDown} ');
    expect(screen.getByTestId('path')).toHaveTextContent('/responses');
    expect(menu()).not.toBeInTheDocument();
  });

  it('has no axe violations, closed or open', async () => {
    const { user, trigger, container } = renderMenu();
    await expectNoAxeViolations(container);

    await user.click(trigger);
    await expectNoAxeViolations(container);
  });
});
