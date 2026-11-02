import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { assertNever } from '../domain/assertNever';
import styles from './ActionMenu.module.css';
import { IconButton } from './Button';
import { Icon, type IconName } from './icons';

/** One entry in the menu, as data: the menu decides how each kind is rendered and focused. */
export type ActionMenuItem =
  | { kind: 'link'; label: string; to: string; icon: IconName }
  | { kind: 'action'; label: string; icon: IconName; tone?: 'danger'; onSelect: () => void }
  | { kind: 'separator' };

interface ActionMenuProps {
  /** The trigger's accessible name, which also names the menu. Unique per page, e.g. "More actions for Travel". */
  label: string;
  items: readonly ActionMenuItem[];
}

type FocusTarget = 'first' | 'last';

/**
 * A kebab button that opens a list of secondary actions, following the WAI-ARIA APG menu button
 * pattern: the trigger opens the menu and focus moves into it; arrows, Home and End move between
 * items (roving focus, so the menu is one Tab stop); Escape closes and returns to the trigger;
 * Tab or focus leaving closes it.
 *
 * Choosing an item puts focus back on the trigger *before* the item runs. The item unmounts with
 * the menu, so anything it opens (a dialog, which records the focused element as the place to
 * return to) must see the trigger focused, not an element about to disappear.
 */
export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const focusOnOpen = useRef<FocusTarget>('first');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const all = menuItemsIn(menuRef.current);
    (focusOnOpen.current === 'first' ? all[0] : all.at(-1))?.focus();
  }, [open]);

  const openMenu = (target: FocusTarget) => {
    focusOnOpen.current = target;
    setOpen(true);
  };

  const closeToTrigger = () => {
    triggerRef.current?.focus();
    setOpen(false);
  };

  // Focus left for somewhere outside the menu and its trigger: a click elsewhere, or a screen
  // reader moving on. `relatedTarget` is null when focus falls to the page itself.
  const closeIfFocusLeft = (event: FocusEvent) => {
    if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Enter and Space reach `onClick` natively; only the arrows need handling here.
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = menuItemsIn(menuRef.current);
    const current = all.findIndex((item) => item === document.activeElement);
    const focusAt = (index: number) => {
      event.preventDefault();
      all[(index + all.length) % all.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        focusAt(current + 1);
        return;
      case 'ArrowUp':
        focusAt(current - 1);
        return;
      case 'Home':
        focusAt(0);
        return;
      case 'End':
        focusAt(all.length - 1);
        return;
      case 'Escape':
        event.preventDefault();
        closeToTrigger();
        return;
      case 'Tab':
        // Not prevented: from the trigger, the browser's Tab carries on to the next control,
        // which it could not do from an item that is about to unmount.
        closeToTrigger();
        return;
      case ' ':
        // Space activates a menu item; a link does not do that natively, a button does.
        if (event.target instanceof HTMLAnchorElement) {
          event.preventDefault();
          event.target.click();
        }
        return;
      default:
        return;
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <IconButton
        ref={triggerRef}
        id={triggerId}
        icon="more"
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={open ? styles.triggerOpen : undefined}
        // While open, a press on the trigger must not move focus first: Safari, which does not
        // focus buttons on click, would blur to the page, close the menu, and the click reopen it.
        onMouseDown={(event) => {
          if (open) event.preventDefault();
        }}
        onClick={() => {
          if (open) closeToTrigger();
          else openMenu('first');
        }}
        onKeyDown={onTriggerKeyDown}
        onBlur={closeIfFocusLeft}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          // Reachable by script only: focus lives on the items, one at a time (roving focus).
          tabIndex={-1}
          aria-labelledby={triggerId}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
          onBlur={closeIfFocusLeft}
        >
          {items.map((item, index) => (
            <MenuEntry
              key={item.kind === 'separator' ? `separator-${index}` : item.label}
              item={item}
              onChosen={closeToTrigger}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function menuItemsIn(menu: HTMLDivElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
}

interface MenuEntryProps {
  item: ActionMenuItem;
  /** Runs before the item's own effect, so focus is already back on the trigger. */
  onChosen: () => void;
}

function MenuEntry({ item, onChosen }: MenuEntryProps): ReactNode {
  switch (item.kind) {
    case 'separator':
      return <div role="separator" className={styles.separator} />;
    case 'link':
      return (
        <Link role="menuitem" tabIndex={-1} to={item.to} className={styles.item} onClick={onChosen}>
          <Icon name={item.icon} />
          {item.label}
        </Link>
      );
    case 'action':
      return (
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={[styles.item, item.tone === 'danger' && styles.danger]
            .filter(Boolean)
            .join(' ')}
          onClick={() => {
            onChosen();
            item.onSelect();
          }}
        >
          <Icon name={item.icon} />
          {item.label}
        </button>
      );
    default:
      return assertNever(item);
  }
}
