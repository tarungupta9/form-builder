import { useDraggable } from '@dnd-kit/core';
import type { FieldType } from '../../domain/template';
import { FIELD_TYPES, definitionFor } from '../../fields/registry';
import { Icon } from '../../ui/icons';
import styles from './Builder.module.css';
import { paletteDragId } from './dragAndDrop';

/** One button per registered field type, so a new plugin appears here with no change to this file. */
export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <section className={styles.palette} aria-labelledby="palette-title">
      <h2 id="palette-title" className={styles.panelTitle}>
        Add a field
      </h2>
      <ul className={styles.paletteList}>
        {FIELD_TYPES.map((type) => (
          <li key={type}>
            <PaletteButton type={type} onAdd={onAdd} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Click, Enter or Space adds the field after the selection. A pointer can also drag it onto the
 * canvas (D8-3). Only the listeners are spread, not dnd-kit's attributes: the button must not be
 * described as draggable to a keyboard or screen-reader user, for whom it is not.
 */
function PaletteButton({ type, onAdd }: { type: FieldType; onAdd: (type: FieldType) => void }) {
  const definition = definitionFor(type);
  const { setNodeRef, listeners } = useDraggable({
    id: paletteDragId(type),
    data: { source: 'palette', type },
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      className={styles.paletteButton}
      onClick={() => {
        onAdd(type);
      }}
    >
      <Icon name={definition.icon} />
      {/* The visible type name is kept whole in the accessible name (WCAG 2.5.3). */}
      <span className="visually-hidden">Add </span>
      {definition.paletteLabel}
    </button>
  );
}

/** The chip that follows the pointer while a palette button is dragged. */
export function PaletteChip({ type }: { type: FieldType }) {
  const definition = definitionFor(type);
  return (
    <div className={styles.paletteChip}>
      <Icon name={definition.icon} />
      {definition.paletteLabel}
    </div>
  );
}
