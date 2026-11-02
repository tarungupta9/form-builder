import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  type KeyboardSensorOptions,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { type ReactNode, useMemo, useState } from 'react';
import type { FieldId } from '../../domain/ids';
import type { Field, FieldType } from '../../domain/template';
import {
  CanvasKeyboardSensor,
  REORDER_INSTRUCTIONS,
  builderCollisions,
  dragSourceOf,
  reorderAnnouncements,
  resolveDrop,
} from './dragAndDrop';
import { PaletteChip } from './FieldPalette';

/*
 * Module constants, not inline objects: dnd-kit rebuilds its sensors, and with them every
 * draggable's listeners, whenever an options object changes identity.
 */
/** A short distance before a drag starts keeps a click a click. */
const POINTER_OPTIONS = { activationConstraint: { distance: 8 } };
/**
 * When the next place is off-centre, the sensor first scrolls the page to it. An instant scroll
 * means the next arrow key always moves the field, with no animation to wait out.
 */
const KEYBOARD_OPTIONS: KeyboardSensorOptions = {
  coordinateGetter: sortableKeyboardCoordinates,
  scrollBehavior: 'auto',
};

interface BuilderDragAndDropProps {
  fields: readonly Field[];
  /** A canvas item was dropped elsewhere in the list. */
  onMove: (fieldId: FieldId, toIndex: number) => void;
  /** A palette button was dropped on the canvas. */
  onAdd: (type: FieldType, at: number) => void;
  children: ReactNode;
}

/**
 * The drag context around the palette and the canvas (ADR 0016). A drop is turned into the same
 * `field/moved` or `field/added` the buttons send, by `resolveDrop`. dnd-kit's own live region
 * speaks the drag, so the callers announce nothing for a drop (D8-2); it also returns focus to
 * the handle after a keyboard drop.
 */
export function BuilderDragAndDrop({ fields, onMove, onAdd, children }: BuilderDragAndDropProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_OPTIONS),
    useSensor(CanvasKeyboardSensor, KEYBOARD_OPTIONS),
  );
  const announcements = useMemo(() => reorderAnnouncements(fields), [fields]);
  const [dragged, setDragged] = useState<FieldType | null>(null);

  const handleDragStart = ({ active }: DragStartEvent) => {
    const source = dragSourceOf(active);
    setDragged(source?.source === 'palette' ? source.type : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    const drop = resolveDrop(active, over, fields);
    if (drop?.kind === 'move') onMove(drop.fieldId, drop.toIndex);
    if (drop?.kind === 'add') onAdd(drop.type, drop.at);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={builderCollisions}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: REORDER_INSTRUCTIONS },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null);
      }}
    >
      {children}
      {/*
        Mounted only for a palette drag. While mounted, dnd-kit measures collisions from the
        overlay, not the item; a canvas item is dragged in place, so it has no overlay.
      */}
      {dragged && (
        <DragOverlay dropAnimation={null}>
          <PaletteChip type={dragged} />
        </DragOverlay>
      )}
    </DndContext>
  );
}
