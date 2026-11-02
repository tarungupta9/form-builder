import { condition, group, textField } from '../../test/fixtures';
import { buildDependencyGraph, transitiveDependants, wouldCreateCycle } from './graph';

/** A → B → C: B reads A, C reads B. */
function chain() {
  const a = textField('A');
  const b = textField('B');
  const c = textField('C');
  b.logic.show = group('all', condition(a.id, { kind: 'text', op: 'equals', value: 'x' }));
  c.logic.show = group('all', condition(b.id, { kind: 'text', op: 'equals', value: 'x' }));
  return { a, b, c, graph: buildDependencyGraph([a, b, c]) };
}

describe('dependency graph', () => {
  it('orders every field after the fields it reads, whatever the form order', () => {
    const a = textField('A');
    const b = textField('B');
    const c = textField('C');
    b.logic.show = group('all', condition(a.id, { kind: 'text', op: 'equals', value: 'x' }));
    c.logic.show = group('all', condition(b.id, { kind: 'text', op: 'equals', value: 'x' }));

    const graph = buildDependencyGraph([c, b, a]);

    expect(graph.order).toEqual([a.id, b.id, c.id]);
    expect(graph.cyclic.size).toBe(0);
  });

  it('ignores a condition on a field that no longer exists', () => {
    const a = textField('A');
    const gone = textField('Deleted');
    a.logic.hide = group('all', condition(gone.id, { kind: 'text', op: 'equals', value: 'x' }));

    expect(buildDependencyGraph([a]).order).toEqual([a.id]);
  });

  it('reports fields in a cycle, and the fields downstream of it, instead of ordering them', () => {
    const x = textField('X');
    const y = textField('Y');
    const z = textField('Z');
    x.logic.hide = group('all', condition(y.id, { kind: 'text', op: 'equals', value: '1' }));
    y.logic.hide = group('all', condition(x.id, { kind: 'text', op: 'equals', value: '1' }));
    z.logic.hide = group('all', condition(y.id, { kind: 'text', op: 'equals', value: '1' }));

    const graph = buildDependencyGraph([x, y, z]);

    expect(graph.order).toEqual([]);
    expect([...graph.cyclic].sort()).toEqual([x.id, y.id, z.id].sort());
  });

  it('finds direct and indirect dependants', () => {
    const { a, b, c, graph } = chain();

    expect([...transitiveDependants(graph, a.id)].sort()).toEqual([b.id, c.id].sort());
    expect([...transitiveDependants(graph, c.id)]).toEqual([]);
  });

  it('refuses a condition on the field itself', () => {
    const { a, graph } = chain();

    expect(wouldCreateCycle(graph, a.id, a.id)).toBe(true);
  });

  it('refuses a condition that would close a loop through a chain', () => {
    const { a, c, graph } = chain();

    // C already depends on A (through B), so A may not read C; C reading A again is fine.
    expect(wouldCreateCycle(graph, a.id, c.id)).toBe(true);
    expect(wouldCreateCycle(graph, c.id, a.id)).toBe(false);
  });
});
