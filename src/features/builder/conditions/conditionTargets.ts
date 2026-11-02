/**
 * Which fields a condition may read, and what changing its target does to it. Pure, so every
 * rule here is tested without rendering the editor.
 *
 * A field may read any other field, above or below it (Q-4), as long as that field holds an
 * answer (its plugin gives a `conditionTarget`) and reading it would not make a loop (D-6).
 */
import { type FieldId, newConditionId } from '../../../domain/ids';
import { type DependencyGraph, wouldCreateCycle } from '../../../domain/rules/graph';
import { emptyPredicate } from '../../../domain/rules/predicates';
import type { Condition, Field } from '../../../domain/template';
import type { ConditionTarget } from '../../../fields/contract';
import { definitionOf } from '../../../fields/registry';
import { fieldName } from '../Canvas';

export interface TargetChoice {
  field: Field;
  /** "Field 3, Nights": the position keeps duplicate or missing labels apart. */
  name: string;
  target: ConditionTarget;
  /** Why it cannot be chosen, shown in the option itself; `null` when it can. */
  disabledReason: string | null;
}

export const DEPENDS_ON_THIS_FIELD = 'depends on this field';

/** How the editor refers to a field: by position, as the canvas numbers it, and by label. */
export function positionName(field: Field, index: number): string {
  const label = field.label.trim();
  return label ? `Field ${index + 1}, ${label}` : `Field ${index + 1} (no label yet)`;
}

/** Every field `ownerId` could read, in form order. The owner itself is never offered. */
export function allowedTargets(
  fields: readonly Field[],
  graph: DependencyGraph,
  ownerId: FieldId,
): TargetChoice[] {
  return fields.flatMap((field, index) => {
    if (field.id === ownerId) return [];
    const target = definitionOf(field).conditionTarget(field);
    if (!target) return [];
    const loops = wouldCreateCycle(graph, ownerId, field.id);
    return [
      {
        field,
        name: positionName(field, index),
        target,
        disabledReason: loops ? DEPENDS_ON_THIS_FIELD : null,
      },
    ];
  });
}

/** "A", "A and B", "A, B and C". */
const listOf = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/**
 * The visible reason under the target select. The option text says it too, but some screen
 * readers skip disabled options, so the hint is what makes the reason reliably reachable.
 */
export function loopHint(choices: readonly TargetChoice[]): string | null {
  const blocked = choices.filter((choice) => choice.disabledReason !== null);
  if (blocked.length === 0) return null;
  const names = listOf(blocked.map((choice) => fieldName(choice.field)));
  return blocked.length === 1
    ? `Can’t choose ${names}: it already depends on this field, so a condition on it would make a loop.`
    : `Can’t choose ${names}: they already depend on this field, so a condition on them would make a loop.`;
}

/**
 * A condition the author has just added: it reads the nearest field above the owner, since
 * conditions usually look back up the form, else the first field below. `null` when there is
 * nothing it could read.
 */
export function newCondition(
  fields: readonly Field[],
  choices: readonly TargetChoice[],
  ownerId: FieldId,
): Condition | null {
  const ownerIndex = fields.findIndex((field) => field.id === ownerId);
  const allowed = choices.filter((choice) => choice.disabledReason === null);
  const above = allowed.filter((choice) => fields.indexOf(choice.field) < ownerIndex);
  const choice = above.at(-1) ?? allowed[0];
  if (!choice) return null;
  return {
    id: newConditionId(),
    targetFieldId: choice.field.id,
    predicate: emptyPredicate(choice.target.kind),
  };
}

/**
 * The condition reading another field. The comparison is kept when the new target is read the
 * same way (text to text, number to number, date to date); otherwise it starts again, and always
 * for a choice, because option IDs belong to the field they came from.
 */
export function retarget(condition: Condition, choice: TargetChoice): Condition {
  if (choice.field.id === condition.targetFieldId) return condition;
  const { kind } = choice.target;
  const keeps = kind === condition.predicate.kind && kind !== 'choice' && kind !== 'multi';
  return {
    ...condition,
    targetFieldId: choice.field.id,
    predicate: keeps ? condition.predicate : emptyPredicate(kind),
  };
}
