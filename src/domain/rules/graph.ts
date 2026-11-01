import type { FieldId } from '../ids';
import { type Field, groupsOf } from '../template';

/**
 * Who reads whom. A field reads another when it has a condition on it. Evaluating in
 * topological order means every field reads targets that are already resolved, which gives
 * correct chaining (A → B → C) in a single pass (D-5).
 */
export interface DependencyGraph {
  /** Fields in dependency order. Fields caught in a cycle are not in it. */
  order: readonly FieldId[];
  /** Fields in or downstream of a cycle; the engine treats them as their defaults (D-6). */
  cyclic: ReadonlySet<FieldId>;
}

/** The fields `field` reads through its conditions. */
function dependenciesOf(field: Field): Set<FieldId> {
  const reads = new Set<FieldId>();
  for (const { group } of groupsOf(field.logic)) {
    for (const condition of group.conditions) reads.add(condition.targetFieldId);
  }
  return reads;
}

export function buildDependencyGraph(fields: readonly Field[]): DependencyGraph {
  const known = new Set(fields.map((field) => field.id));
  const reads = new Map<FieldId, Set<FieldId>>();
  const readBy = new Map<FieldId, Set<FieldId>>();
  for (const field of fields) {
    reads.set(field.id, new Set());
    readBy.set(field.id, new Set());
  }
  for (const field of fields) {
    for (const target of dependenciesOf(field)) {
      // A reference to a deleted field reads nothing. From v0.7 the builder removes such
      // references when the field is deleted (D-12).
      if (!known.has(target)) continue;
      reads.get(field.id)?.add(target);
      readBy.get(target)?.add(field.id);
    }
  }

  // Kahn's algorithm, seeded in form order so the result is stable and easy to reason about.
  const unresolved = new Map(fields.map((field) => [field.id, reads.get(field.id)?.size ?? 0]));
  const queue = fields.filter((field) => unresolved.get(field.id) === 0).map((field) => field.id);
  const order: FieldId[] = [];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === undefined) break;
    order.push(next);
    for (const dependant of readBy.get(next) ?? []) {
      const remaining = (unresolved.get(dependant) ?? 0) - 1;
      unresolved.set(dependant, remaining);
      if (remaining === 0) queue.push(dependant);
    }
  }
  const ordered = new Set(order);
  const cyclic = new Set(fields.map((field) => field.id).filter((id) => !ordered.has(id)));

  return { order, cyclic };
}
