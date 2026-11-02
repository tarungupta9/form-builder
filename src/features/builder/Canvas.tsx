import { useDndContext, useDroppable } from '@dnd-kit/core';
import { memo, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FieldId } from '../../domain/ids';
import { type Field, groupsOf, hasRequiredAxis } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { IconButton } from '../../ui/Button';
import { GripIcon, Icon } from '../../ui/icons';
import styles from './Builder.module.css';
import { CANVAS_DROP_ID, dragSourceOf } from './dragAndDrop';

/** The canvas item's DOM ID, for moving focus to a field. */
export const canvasItemId = (fieldId: FieldId): string => `canvas-item-${fieldId}`;

export type MoveDirection = 'up' | 'down';

/** A Move button's DOM ID, so focus can follow the field it moved. */
export const moveButtonId = (fieldId: FieldId, direction: MoveDirection): string =>
  `canvas-move-${direction}-${fieldId}`;

/** How the builder refers to a field: its label, or a neutral phrase while it has none. */
export const fieldName = (field: Field): string => field.label.trim() || 'Untitled field';

const hasConditions = (field: Field): boolean =>
  groupsOf(field.logic).some(({ group }) => group.conditions.length > 0);

interface CanvasProps {
  fields: readonly Field[];
  selectedFieldId: FieldId | null;
  fieldsWithIssues: ReadonlySet<FieldId>;
  onSelect: (fieldId: FieldId) => void;
  /** A Move button was pressed; a drag reports its drop to the builder's drag context instead. */
  onMove: (fieldId: FieldId, direction: MoveDirection) => void;
  onRemove: (field: Field) => void;
}

/**
 * The form's fields in order. Each item is a button that selects the field (`aria-pressed`
 * says which one is selected), with its own controls beside it, never nested inside it: the
 * drag handle, Move up and Move down, and Remove. The handle and the Move buttons are two
 * inputs for one action (ADR 0016): the buttons are the single-pointer way to reorder that
 * WCAG 2.5.7 asks for, which keyboard dragging alone does not give.
 */
export function Canvas({
  fields,
  selectedFieldId,
  fieldsWithIssues,
  onSelect,
  onMove,
  onRemove,
}: CanvasProps) {
  const ids = useFieldIds(fields);
  // The canvas itself only takes palette drops; while reordering it would compete with the items.
  const { active } = useDndContext();
  const { setNodeRef } = useDroppable({
    id: CANVAS_DROP_ID,
    disabled: !active || dragSourceOf(active)?.source !== 'palette',
  });

  return (
    <section ref={setNodeRef} className={styles.canvas} aria-labelledby="canvas-title">
      <h2 id="canvas-title" tabIndex={-1} className={styles.panelTitle}>
        Fields
      </h2>
      {fields.length === 0 ? (
        <p className={styles.canvasEmpty}>
          No fields yet. Choose a field type to add the first one.
        </p>
      ) : (
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol aria-labelledby="canvas-title" className={styles.canvasList}>
            {fields.map((field, index) => (
              <CanvasItem
                key={field.id}
                field={field}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                selected={field.id === selectedFieldId}
                hasIssues={fieldsWithIssues.has(field.id)}
                onSelect={onSelect}
                onMove={onMove}
                onRemove={onRemove}
              />
            ))}
          </ol>
        </SortableContext>
      )}
    </section>
  );
}

/**
 * The fields' IDs in order, as the same array until a field is added, removed or moved. dnd-kit
 * re-renders every sortable item when this array changes identity, so a fresh `map` on each
 * render would undo `CanvasItem`'s memo on every keystroke.
 */
function useFieldIds(fields: readonly Field[]): FieldId[] {
  const [ids, setIds] = useState(() => fields.map((field) => field.id));
  const sameOrder = ids.length === fields.length && fields.every((field, i) => field.id === ids[i]);
  if (!sameOrder) {
    const next = fields.map((field) => field.id);
    setIds(next);
    return next;
  }
  return ids;
}

interface CanvasItemProps {
  field: Field;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  hasIssues: boolean;
  onSelect: (fieldId: FieldId) => void;
  onMove: (fieldId: FieldId, direction: MoveDirection) => void;
  onRemove: (field: Field) => void;
}

/**
 * One field on the canvas. Only the handle starts a drag: dnd-kit's keyboard sensor starts on
 * Enter as well as Space, which on the select button would take selection away (D8-1). The
 * handle gets dnd-kit's attributes, so its `aria-pressed` never meets the select button's.
 *
 * Memoised: its props are the field (a new object only when that field changes), booleans and
 * the builder's stable handlers, so typing in the config panel re-renders the edited field's
 * item and no other. dnd-kit still re-renders the items a drag moves.
 */
const CanvasItem = memo(function CanvasItem({
  field,
  isFirst,
  isLast,
  selected,
  hasIssues,
  onSelect,
  onMove,
  onRemove,
}: CanvasItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, data: { source: 'canvas' } });
  const name = fieldName(field);

  return (
    <li
      ref={setNodeRef}
      className={[styles.canvasItem, isDragging && styles.dragging].filter(Boolean).join(' ')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}`}
        className={styles.dragHandle}
      >
        <GripIcon />
      </button>
      <button
        type="button"
        id={canvasItemId(field.id)}
        aria-pressed={selected}
        className={styles.canvasSelect}
        onClick={() => {
          onSelect(field.id);
        }}
      >
        <span className={styles.canvasLabel}>{name}</span>
        <span className={styles.canvasSummary}>{definitionOf(field).summarize(field)}</span>
        <span className={styles.canvasTags}>
          {hasRequiredAxis(field.logic) && field.logic.defaultRequired && (
            <span className={styles.requiredTag}>Required</span>
          )}
          {/* Words, not icons, so they are read as part of the select button's name (D6-7). */}
          {!field.logic.defaultVisible && <span className={styles.logicTag}>Hidden at start</span>}
          {hasConditions(field) && <span className={styles.logicTag}>Conditional</span>}
          {hasIssues && (
            <span className={styles.issueTag}>
              <Icon name="alert" size={16} />
              Needs attention
            </span>
          )}
        </span>
      </button>
      {/* Native `disabled` at the ends: there is nowhere to go, so the button leaves the tab order. */}
      <IconButton
        id={moveButtonId(field.id, 'up')}
        icon="chevronUp"
        label={`Move ${name} up`}
        disabled={isFirst}
        onClick={() => {
          onMove(field.id, 'up');
        }}
      />
      <IconButton
        id={moveButtonId(field.id, 'down')}
        icon="chevronDown"
        label={`Move ${name} down`}
        disabled={isLast}
        onClick={() => {
          onMove(field.id, 'down');
        }}
      />
      <IconButton
        icon="trash"
        label={`Remove ${name}`}
        onClick={() => {
          onRemove(field);
        }}
      />
    </li>
  );
});
