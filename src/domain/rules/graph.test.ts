import { condition, group, textField } from '../../test/fixtures';
import { buildDependencyGraph } from './graph';

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
});
