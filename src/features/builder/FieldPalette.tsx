import type { FieldType } from '../../domain/template';
import { FIELD_TYPES, definitionFor } from '../../fields/registry';
import { Icon } from '../../ui/icons';
import styles from './Builder.module.css';

/** One button per registered field type, so a new plugin appears here with no change to this file. */
export function FieldPalette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <section className={styles.palette} aria-labelledby="palette-title">
      <h2 id="palette-title" className={styles.panelTitle}>
        Add a field
      </h2>
      <ul className={styles.paletteList}>
        {FIELD_TYPES.map((type) => {
          const definition = definitionFor(type);
          return (
            <li key={type}>
              <button
                type="button"
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
