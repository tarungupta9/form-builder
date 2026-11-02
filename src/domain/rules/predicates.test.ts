import { choice, date, isoDate, multi, num, text } from '../../test/fixtures';
import { newOptionId } from '../ids';
import type { FieldValue } from '../response';
import type { Predicate, PredicateKind } from '../template';
import {
  OPERATORS,
  emptyPredicate,
  isPredicateComplete,
  predicateHolds,
  withOperator,
} from './predicates';

// Predicates read values, not fields, so every kind is covered before its field type exists.
const a = { id: newOptionId() };
const b = { id: newOptionId() };
const c = { id: newOptionId() };

describe('predicateHolds', () => {
  it('compares text trimmed and case-insensitively', () => {
    expect(predicateHolds({ kind: 'text', op: 'equals', value: 'Yes' }, text(' yes '))).toBe(true);
    expect(predicateHolds({ kind: 'text', op: 'notEquals', value: 'Yes' }, text('no'))).toBe(true);
    expect(
      predicateHolds({ kind: 'text', op: 'contains', value: 'LYON' }, text('Lyon, France')),
    ).toBe(true);
  });

  it('treats "Yes" and " YES " as the same answer for "does not equal" and "contains" too', () => {
    expect(predicateHolds({ kind: 'text', op: 'notEquals', value: 'Yes' }, text(' YES '))).toBe(
      false,
    );
    expect(
      predicateHolds({ kind: 'text', op: 'contains', value: '  lyon ' }, text('Lyon, France')),
    ).toBe(true);
  });

  it('treats "is within range" as inclusive at both ends', () => {
    const between = { kind: 'number', op: 'between', value: { min: 10, max: 20 } } as const;
    expect(predicateHolds(between, num('10'))).toBe(true);
    expect(predicateHolds(between, num('20'))).toBe(true);
    expect(predicateHolds(between, num('20.01'))).toBe(false);
  });

  it('never holds for a range whose minimum is above its maximum', () => {
    expect(
      predicateHolds({ kind: 'number', op: 'between', value: { min: 20, max: 10 } }, num('15')),
    ).toBe(false);
  });

  it('never holds for a range with only one end filled in', () => {
    expect(
      predicateHolds({ kind: 'number', op: 'between', value: { min: null, max: 20 } }, num('15')),
    ).toBe(false);
    expect(
      predicateHolds({ kind: 'number', op: 'between', value: { min: 10, max: null } }, num('15')),
    ).toBe(false);
  });

  it('compares numbers by value, not by how they were typed', () => {
    expect(predicateHolds({ kind: 'number', op: 'equals', value: 1.5 }, num('1.50'))).toBe(true);
    expect(predicateHolds({ kind: 'number', op: 'gt', value: 50 }, num('50'))).toBe(false);
    expect(predicateHolds({ kind: 'number', op: 'lt', value: 50 }, num('-3'))).toBe(true);
  });

  it('distinguishes contains any, all and none of for multi select', () => {
    const selected = multi(a.id, b.id);
    expect(
      predicateHolds({ kind: 'multi', op: 'containsAny', value: [b.id, c.id] }, selected),
    ).toBe(true);
    expect(
      predicateHolds({ kind: 'multi', op: 'containsAll', value: [a.id, c.id] }, selected),
    ).toBe(false);
    expect(
      predicateHolds({ kind: 'multi', op: 'containsAll', value: [a.id, b.id] }, selected),
    ).toBe(true);
    expect(predicateHolds({ kind: 'multi', op: 'containsNone', value: [c.id] }, selected)).toBe(
      true,
    );
    expect(predicateHolds({ kind: 'multi', op: 'containsNone', value: [a.id] }, selected)).toBe(
      false,
    );
  });

  it('orders dates by calendar day', () => {
    const target = isoDate('2026-10-31');
    expect(predicateHolds({ kind: 'date', op: 'before', value: target }, date('2026-10-30'))).toBe(
      true,
    );
    expect(predicateHolds({ kind: 'date', op: 'after', value: target }, date('2026-11-01'))).toBe(
      true,
    );
    expect(predicateHolds({ kind: 'date', op: 'equals', value: target }, date('2026-10-31'))).toBe(
      true,
    );
  });

  it.each<[string, Predicate, FieldValue | undefined]>([
    ['text', { kind: 'text', op: 'notEquals', value: 'x' }, text('  ')],
    ['multi', { kind: 'multi', op: 'containsNone', value: [a.id] }, multi()],
    ['number', { kind: 'number', op: 'lt', value: 5 }, num('')],
    ['choice', { kind: 'choice', op: 'notEquals', value: a.id }, choice(null)],
    [
      'date',
      { kind: 'date', op: 'before', value: isoDate('2026-10-31') },
      { kind: 'date', value: null },
    ],
    ['missing', { kind: 'text', op: 'notEquals', value: 'x' }, undefined],
  ])(
    'is inactive for an empty %s target, even for negative operators',
    (_name, predicate, value) => {
      expect(predicateHolds(predicate, value)).toBe(false);
    },
  );

  it('never matches a value of a different kind', () => {
    expect(predicateHolds({ kind: 'text', op: 'equals', value: '5' }, num('5'))).toBe(false);
  });
});

describe('operators', () => {
  it('offers the spec’s operators for each kind of target, in the spec’s order', () => {
    const labels = (kind: PredicateKind) => OPERATORS[kind].map((entry) => entry.label);

    expect(labels('text')).toEqual(['equals', 'does not equal', 'contains']);
    expect(labels('number')).toEqual([
      'equals',
      'is greater than',
      'is less than',
      'is within range',
    ]);
    expect(labels('choice')).toEqual(['equals', 'does not equal']);
    expect(labels('multi')).toEqual(['contains any of', 'contains all of', 'contains none of']);
    expect(labels('date')).toEqual(['equals', 'is before', 'is after']);
  });

  it.each<PredicateKind>(['text', 'number', 'choice', 'multi', 'date'])(
    'starts a new %s condition unfinished, with the first operator',
    (kind) => {
      const predicate = emptyPredicate(kind);

      expect(predicate.kind).toBe(kind);
      expect(predicate.op).toBe(OPERATORS[kind][0].op);
      expect(isPredicateComplete(predicate)).toBe(false);
    },
  );

  it('keeps the number when switching to and from "is within range"', () => {
    const greater: Predicate = { kind: 'number', op: 'gt', value: 3 };

    const range = withOperator(greater, 'between');
    expect(range).toEqual({ kind: 'number', op: 'between', value: { min: 3, max: null } });
    expect(
      withOperator({ kind: 'number', op: 'between', value: { min: 3, max: 8 } }, 'lt'),
    ).toEqual({
      kind: 'number',
      op: 'lt',
      value: 3,
    });
  });

  it('keeps the value when switching between operators of the same shape', () => {
    const selected = [a.id, b.id];

    expect(
      withOperator({ kind: 'multi', op: 'containsAny', value: selected }, 'containsNone'),
    ).toEqual({
      kind: 'multi',
      op: 'containsNone',
      value: selected,
    });
    expect(withOperator({ kind: 'text', op: 'equals', value: 'Yes' }, 'contains')).toEqual({
      kind: 'text',
      op: 'contains',
      value: 'Yes',
    });
  });

  it('ignores an operator that does not belong to the kind', () => {
    const predicate: Predicate = { kind: 'choice', op: 'equals', value: a.id };

    expect(withOperator(predicate, 'gt')).toBe(predicate);
  });
});
