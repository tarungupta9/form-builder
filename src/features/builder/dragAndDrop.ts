/**
 * The builder's drag and drop, apart from the components (ADR 0016). Two things can be
 * dragged: a canvas item, to reorder it, and a palette button, to add a field where it lands.
 * Everything here is plain functions over dnd-kit's `active` and `over`, so the rules are
 * tested without a pointer.
 */
import {
  type Active,
  type Announcements,
  type CollisionDetection,
  KeyboardSensor,
  type Over,
  type UniqueIdentifier,
  closestCenter,
  pointerWithin,
} from '@dnd-kit/core';
import type { FieldId } from '../../domain/ids';
import type { Field, FieldType } from '../../domain/template';
import { FIELD_TYPES, definitionFor } from '../../fields/registry';
import { fieldName } from './Canvas';

/** The droppable behind the whole canvas, so a palette drop on an empty canvas or a gap lands. */
export const CANVAS_DROP_ID = 'canvas';

export const paletteDragId = (type: FieldType): string => `palette:${type}`;

/** What a drag carries in dnd-kit's `data`. */
export type DragSource = { source: 'canvas' } | { source: 'palette'; type: FieldType };

export type Drop =
  | { kind: 'move'; fieldId: FieldId; toIndex: number }
  | { kind: 'add'; type: FieldType; at: number };

const isFieldType = (value: unknown): value is FieldType =>
  FIELD_TYPES.some((type) => type === value);

/** dnd-kit types `data` loosely, so it is narrowed here before anything reads it. */
export function dragSourceOf(active: Pick<Active, 'data'>): DragSource | null {
  const data: unknown = active.data.current;
  if (typeof data !== 'object' || data === null || !('source' in data)) return null;
  if (data.source === 'canvas') return { source: 'canvas' };
  if (data.source === 'palette' && 'type' in data && isFieldType(data.type))
    return { source: 'palette', type: data.type };
  return null;
}

const indexOf = (fields: readonly Field[], id: UniqueIdentifier | undefined): number =>
  fields.findIndex((field) => field.id === id);

/**
 * What a drop does. A canvas item dropped on another takes that item's place. A palette button
 * dropped on an item inserts the new field at that item's index; dropped on the canvas around
 * the items, it goes at the end. Anything else, including a drop outside the canvas, does nothing.
 */
export function resolveDrop(
  active: Pick<Active, 'id' | 'data'>,
  over: Pick<Over, 'id'> | null,
  fields: readonly Field[],
): Drop | null {
  const source = dragSourceOf(active);
  if (!source || !over) return null;
  const overIndex = indexOf(fields, over.id);

  if (source.source === 'palette') {
    if (overIndex !== -1) return { kind: 'add', type: source.type, at: overIndex };
    return over.id === CANVAS_DROP_ID
      ? { kind: 'add', type: source.type, at: fields.length }
      : null;
  }
  const field = fields[indexOf(fields, active.id)];
  if (!field || overIndex === -1 || field.id === over.id) return null;
  return { kind: 'move', fieldId: field.id, toIndex: overIndex };
}

/**
 * Reordering picks the nearest item. A palette drag first has to be over the canvas, then lands
 * on the nearest item there, so a drop between two items goes beside them rather than at the end.
 */
export const builderCollisions: CollisionDetection = (args) => {
  const items = args.droppableContainers.filter((container) => container.id !== CANVAS_DROP_ID);
  if (dragSourceOf(args.active)?.source !== 'palette')
    return closestCenter({ ...args, droppableContainers: items });
  const within = pointerWithin(args);
  if (!within.some((collision) => collision.id === CANVAS_DROP_ID)) return within;
  const nearest = closestCenter({ ...args, droppableContainers: items });
  return nearest.length > 0 ? nearest : within;
};

/**
 * Keyboard dragging is for canvas items only (D8-3). A palette button keeps Enter and Space as
 * "add after the selection", which is the keyboard path for adding (HLD §7); without this,
 * dnd-kit's keyboard sensor would start a drag on those keys instead of letting them click.
 */
export class CanvasKeyboardSensor extends KeyboardSensor {
  static override activators = KeyboardSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      dragSourceOf(args[2].active)?.source === 'palette' ? false : activator.handler(...args),
  }));
}

export const REORDER_INSTRUCTIONS =
  'Press Space to pick up the field. Use the up and down arrow keys to move it, Space to drop it, or Escape to cancel. You can also use the Move up and Move down buttons.';

/**
 * What dnd-kit's own live region says during a drag (D8-2). It replaces its text on every
 * event, so each arrow key is heard on its own; the app's batching region would join them.
 * The app's region says nothing about a drag, so no event is spoken twice.
 *
 * dnd-kit reports the item as over its own place straight after pick-up, sometimes before it
 * reports the pick-up itself. Only a change of position is spoken, so that never cuts off
 * "Picked up".
 */
export function reorderAnnouncements(fields: readonly Field[]): Announcements {
  const total = fields.length;
  const nameOf = (active: Pick<Active, 'id' | 'data'>): string => {
    const source = dragSourceOf(active);
    if (source?.source === 'palette') return definitionFor(source.type).paletteLabel;
    const field = fields[indexOf(fields, active.id)];
    return field ? fieldName(field) : 'Field';
  };
  const position = (id: UniqueIdentifier | undefined) => indexOf(fields, id) + 1;
  // Where the drag was last said to be, for this drag; `null` means its own starting place.
  let lastOver: UniqueIdentifier | null = null;

  return {
    onDragStart: ({ active }) => {
      return dragSourceOf(active)?.source === 'palette'
        ? `Picked up ${nameOf(active)}.`
        : `Picked up ${nameOf(active)}, position ${position(active.id)} of ${total}.`;
    },
    onDragOver: ({ active, over }) => {
      if (!over || over.id === (lastOver ?? active.id) || position(over.id) === 0) return undefined;
      lastOver = over.id;
      return `${nameOf(active)} is over position ${position(over.id)} of ${total}.`;
    },
    onDragEnd: ({ active, over }) => {
      lastOver = null;
      const drop = resolveDrop(active, over, fields);
      if (!drop)
        return dragSourceOf(active)?.source === 'palette'
          ? `${nameOf(active)} not added.`
          : `${nameOf(active)} dropped at position ${position(active.id)} of ${total}.`;
      return drop.kind === 'add'
        ? `${nameOf(active)} added at position ${drop.at + 1} of ${total + 1}.`
        : `${nameOf(active)} dropped at position ${drop.toIndex + 1} of ${total}.`;
    },
    onDragCancel: ({ active }) => {
      lastOver = null;
      return dragSourceOf(active)?.source === 'palette'
        ? `${nameOf(active)} not added.`
        : `Reorder cancelled. ${nameOf(active)} is back at position ${position(active.id)}.`;
    },
  };
}
