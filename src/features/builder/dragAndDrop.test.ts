import type { Active } from '@dnd-kit/core';
import type { Field, FieldType } from '../../domain/template';
import { numberField, textField, textareaField } from '../../test/fixtures';
import {
  CANVAS_DROP_ID,
  CanvasKeyboardSensor,
  paletteDragId,
  reorderAnnouncements,
  resolveDrop,
} from './dragAndDrop';

type Drag = Pick<Active, 'id' | 'data'>;

const canvasDrag = (field: Field): Drag => ({
  id: field.id,
  data: { current: { source: 'canvas' } },
});
const paletteDrag = (type: FieldType): Drag => ({
  id: paletteDragId(type),
  data: { current: { source: 'palette', type } },
});

const [purpose, amount, notes] = [
  textField('Purpose'),
  numberField('Amount'),
  textareaField('Notes'),
];
const fields = [purpose, amount, notes];

describe('resolveDrop', () => {
  it('moves a canvas item to the index of the item it is dropped on', () => {
    expect(resolveDrop(canvasDrag(purpose), { id: notes.id }, fields)).toEqual({
      kind: 'move',
      fieldId: purpose.id,
      toIndex: 2,
    });
  });

  it('does nothing when a canvas item is dropped on itself or outside the canvas', () => {
    expect(resolveDrop(canvasDrag(amount), { id: amount.id }, fields)).toBeNull();
    expect(resolveDrop(canvasDrag(amount), null, fields)).toBeNull();
  });

  it('adds a palette field at the index of the item it is dropped on', () => {
    expect(resolveDrop(paletteDrag('date'), { id: amount.id }, fields)).toEqual({
      kind: 'add',
      type: 'date',
      at: 1,
    });
  });

  it('adds a palette field at the end when it is dropped on the canvas around the items, or on an empty canvas', () => {
    expect(resolveDrop(paletteDrag('date'), { id: CANVAS_DROP_ID }, fields)).toEqual({
      kind: 'add',
      type: 'date',
      at: 3,
    });
    expect(resolveDrop(paletteDrag('date'), { id: CANVAS_DROP_ID }, [])).toEqual({
      kind: 'add',
      type: 'date',
      at: 0,
    });
  });

  it('does nothing when a palette field is dropped outside the canvas', () => {
    expect(resolveDrop(paletteDrag('date'), null, fields)).toBeNull();
    expect(resolveDrop(paletteDrag('date'), { id: 'elsewhere' }, fields)).toBeNull();
  });

  it('ignores a drag that carries data it does not recognise', () => {
    const unknown: Drag = { id: 'x', data: { current: { source: 'palette', type: 'video' } } };
    expect(resolveDrop(unknown, { id: CANVAS_DROP_ID }, fields)).toBeNull();
  });
});

describe('CanvasKeyboardSensor', () => {
  const [activator] = CanvasKeyboardSensor.activators;
  const keyDown = (code: string, target: HTMLElement) =>
    ({ nativeEvent: new KeyboardEvent('keydown', { code }), target, preventDefault() {} }) as never;

  it('never starts a keyboard drag from a palette button, so Enter and Space still add', () => {
    const button = document.createElement('button');
    const started = activator?.handler(
      keyDown('Enter', button),
      {},
      {
        active: {
          id: paletteDragId('text'),
          node: { current: button },
          activatorNode: { current: button },
          data: { current: { source: 'palette', type: 'text' } },
        } as never,
      },
    );
    expect(started).toBe(false);
  });

  it('starts one from a canvas item’s handle', () => {
    const handle = document.createElement('button');
    const started = activator?.handler(
      keyDown('Space', handle),
      {},
      {
        active: {
          id: purpose.id,
          node: { current: handle },
          activatorNode: { current: handle },
          data: { current: { source: 'canvas' } },
        } as never,
      },
    );
    expect(started).toBe(true);
  });
});

describe('reorderAnnouncements', () => {
  const say = reorderAnnouncements(fields);

  it('names the field and its position as it is picked up, moved and dropped', () => {
    const drag = canvasDrag(amount) as Active;
    expect(say.onDragStart({ active: drag })).toBe('Picked up Amount, position 2 of 3.');
    expect(say.onDragOver({ active: drag, over: { id: notes.id } as never })).toBe(
      'Amount is over position 3 of 3.',
    );
    expect(say.onDragEnd({ active: drag, over: { id: notes.id } as never })).toBe(
      'Amount dropped at position 3 of 3.',
    );
    expect(say.onDragCancel({ active: drag, over: null })).toBe(
      'Reorder cancelled. Amount is back at position 2.',
    );
  });

  it('says where a palette drop added the field', () => {
    const drag = paletteDrag('date') as Active;
    expect(say.onDragEnd({ active: drag, over: { id: purpose.id } as never })).toBe(
      'Date added at position 1 of 4.',
    );
    expect(say.onDragEnd({ active: drag, over: null })).toBe('Date not added.');
  });
});
