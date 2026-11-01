import type { FieldId } from '../../domain/ids';
import { type Field, hasRequiredAxis } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { IconButton } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import styles from './Builder.module.css';

/** The canvas item's DOM ID, for moving focus to a field. */
export const canvasItemId = (fieldId: FieldId): string => `canvas-item-${fieldId}`;

/** How the builder refers to a field: its label, or a neutral phrase while it has none. */
export const fieldName = (field: Field): string => field.label.trim() || 'Untitled field';

interface CanvasProps {
  fields: readonly Field[];
  selectedFieldId: FieldId | null;
  fieldsWithIssues: ReadonlySet<FieldId>;
  onSelect: (fieldId: FieldId) => void;
  onRemove: (field: Field) => void;
}

/**
 * The form's fields in order. Each item is a button that selects the field (`aria-pressed`
 * says which one is selected) next to its own Remove button, never nested inside it.
 */
export function Canvas({
  fields,
  selectedFieldId,
  fieldsWithIssues,
  onSelect,
  onRemove,
}: CanvasProps) {
  return (
    <section className={styles.canvas} aria-labelledby="canvas-title">
      <h2 id="canvas-title" tabIndex={-1} className={styles.panelTitle}>
        Fields
      </h2>
      {fields.length === 0 ? (
        <p className={styles.canvasEmpty}>
          No fields yet. Choose a field type to add the first one.
        </p>
      ) : (
        <ol aria-labelledby="canvas-title" className={styles.canvasList}>
          {fields.map((field) => (
            <li key={field.id} className={styles.canvasItem}>
              <button
                type="button"
                id={canvasItemId(field.id)}
                aria-pressed={field.id === selectedFieldId}
                className={styles.canvasSelect}
                onClick={() => {
                  onSelect(field.id);
                }}
              >
                <span className={styles.canvasLabel}>{fieldName(field)}</span>
                <span className={styles.canvasSummary}>{definitionOf(field).summarize(field)}</span>
                <span className={styles.canvasTags}>
                  {hasRequiredAxis(field.logic) && field.logic.defaultRequired && (
                    <span className={styles.requiredTag}>Required</span>
                  )}
                  {fieldsWithIssues.has(field.id) && (
                    <span className={styles.issueTag}>
                      <Icon name="alert" size={16} />
                      Needs attention
                    </span>
                  )}
                </span>
              </button>
              <IconButton
                icon="trash"
                label={`Remove ${fieldName(field)}`}
                onClick={() => {
                  onRemove(field);
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
