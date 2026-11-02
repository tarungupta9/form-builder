/**
 * The derived-value seam (ADR 0018), exercised with a stand-in derivation so the engine is
 * proved blind to field types: here a Short text "derives" the other answers joined by "+".
 * The real calculation is tested in its plugin folder and in the v0.9 flow test.
 */
import { condition, group, text, textField } from '../../test/fixtures';
import type { FieldId } from '../ids';
import type { ResponseValues } from '../response';
import type { Field } from '../template';
import type { FieldDerivations } from './derivations';
import { evaluateForm } from './evaluate';
import { buildDependencyGraph, transitiveDependants } from './graph';
import { dependantsOf, withoutReferencesTo } from './references';

/** Fields listed in `sources` are derived; everything else is answered. */
function joining(sources: Map<FieldId, FieldId[]>): FieldDerivations {
  return {
    sourcesOf: (field) => sources.get(field.id) ?? [],
    withoutSource: (field, sourceId) => {
      const list = sources.get(field.id);
      if (!list?.includes(sourceId)) return field;
      // A real plugin returns a new field; the stand-in keeps its sources outside the field.
      sources.set(
        field.id,
        list.filter((id) => id !== sourceId),
      );
      return { ...field };
    },
    derive: (field, effective) => {
      const list = sources.get(field.id);
      if (!list) return null;
      const parts = list.flatMap((id) => {
        const value = effective[id];
        return value?.kind === 'text' ? [value.value] : [];
      });
      return { value: parts.length > 0 ? text(parts.join('+')) : undefined };
    },
  };
}

const isYes = { kind: 'text', op: 'equals', value: 'yes' } as const;

function form() {
  const a = textField('A');
  const b = textField('B');
  const total = textField('Total');
  const derivations = joining(new Map([[total.id, [a.id, b.id]]]));
  return { a, b, total, derivations };
}

describe('derived values', () => {
  it('orders a derived field after its sources, whatever the form order', () => {
    const { a, b, total, derivations } = form();

    const graph = buildDependencyGraph([total, a, b], derivations);

    expect(graph.order).toEqual([a.id, b.id, total.id]);
    expect(transitiveDependants(graph, a.id)).toEqual(new Set([total.id]));
  });

  it('computes the value from the sources and recomputes it when they change', () => {
    const { a, b, total, derivations } = form();
    const fields: Field[] = [total, a, b];

    const first = evaluateForm(fields, { [a.id]: text('1') }, derivations);
    const next = evaluateForm(fields, { [a.id]: text('1'), [b.id]: text('2') }, derivations);

    expect(first.effective[total.id]).toEqual(text('1'));
    expect(next.effective[total.id]).toEqual(text('1+2'));
  });

  it('never sees a hidden source, even though its raw value is kept', () => {
    const { a, b, total, derivations } = form();
    const gate = textField('Include B?');
    b.logic.show = group('all', condition(gate.id, isYes));
    b.logic.defaultVisible = false;
    const values: ResponseValues = { [a.id]: text('1'), [b.id]: text('2') };

    const hidden = evaluateForm([gate, a, b, total], values, derivations);
    const shown = evaluateForm(
      [gate, a, b, total],
      { ...values, [gate.id]: text('yes') },
      derivations,
    );

    expect(hidden.effective[total.id]).toEqual(text('1'));
    expect(shown.effective[total.id]).toEqual(text('1+2'));
  });

  it('leaves a derived field with nothing to compute out of the effective values', () => {
    const { a, b, total, derivations } = form();

    const result = evaluateForm([a, b, total], {}, derivations);

    expect(result.visible.has(total.id)).toBe(true);
    expect(total.id in result.effective).toBe(false);
  });

  it('ignores a raw value stored for a derived field: the result always wins', () => {
    const { a, b, total, derivations } = form();

    const result = evaluateForm([a, b, total], { [total.id]: text('typed') }, derivations);

    expect(total.id in result.effective).toBe(false);
  });

  it('gives a hidden derived field no value', () => {
    const { a, b, total, derivations } = form();
    total.logic.defaultVisible = false;

    const result = evaluateForm([a, b, total], { [a.id]: text('1') }, derivations);

    expect(total.id in result.effective).toBe(false);
  });
});

describe('derived values: deleting a source (D-12)', () => {
  it('lists the derived field as a dependant, after any conditions it has on the source', () => {
    const { a, b, total, derivations } = form();
    total.logic.hide = group('all', condition(a.id, isYes));

    const found = dependantsOf([a, b, total], a.id, derivations);

    expect(found).toEqual([
      {
        field: total,
        reads: [
          { effect: 'hide', count: 1 },
          { effect: 'source', count: 1 },
        ],
      },
    ]);
  });

  it('drops the source and the conditions on it together', () => {
    const { a, b, total, derivations } = form();
    total.logic.hide = group('all', condition(a.id, isYes));

    const cleaned = withoutReferencesTo(total, a.id, derivations);

    expect(cleaned.logic.hide.conditions).toEqual([]);
    expect(derivations.sourcesOf(cleaned)).toEqual([b.id]);
  });
});
