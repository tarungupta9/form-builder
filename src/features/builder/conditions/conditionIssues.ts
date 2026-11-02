/**
 * Problems with a field's conditions that block Save, one per condition, each pointing at the
 * control that fixes it. The rules engine already ignores every one of these (an unfinished or
 * broken condition never holds), so they are about the author's intent, not about safety.
 */
import { assertNever } from '../../../domain/assertNever';
import type { ConditionId } from '../../../domain/ids';
import { type DependencyGraph, wouldCreateCycle } from '../../../domain/rules/graph';
import { isPredicateComplete } from '../../../domain/rules/predicates';
import { optionIdsOf } from '../../../domain/rules/references';
import { type Condition, type Field, type Predicate, groupsOf } from '../../../domain/template';
import type { ConditionTarget } from '../../../fields/contract';
import { definitionOf } from '../../../fields/registry';
import { fieldName } from '../Canvas';
import { type ConditionControl, GROUP_COPY, conditionControlId } from './conditionGroups';

export interface ConditionIssue {
  conditionId: ConditionId;
  /** The control to fix it with, for focus from the issue summary and `aria-invalid`. */
  controlId: string;
  /** For the issue summary: "Show condition 2: enter a number." */
  message: string;
  /** For under the condition itself: "Enter a number." */
  detail: string;
}

interface Problem {
  control: ConditionControl;
  /** Lower case and without a full stop, so it reads after "Show condition 2:". */
  text: string;
}

/** What an unfinished condition still needs. */
function missingValue(predicate: Predicate): Problem {
  switch (predicate.kind) {
    case 'text':
      return { control: 'value', text: 'enter the text to compare with' };
    case 'number':
      if (predicate.op === 'between') {
        const control = predicate.value.min === null ? 'min' : 'max';
        return { control, text: 'enter both numbers' };
      }
      return { control: 'value', text: 'enter a number' };
    case 'choice':
      return { control: 'value', text: 'choose an option' };
    case 'multi':
      return { control: 'value', text: 'choose at least one option' };
    case 'date':
      return { control: 'value', text: 'choose a date' };
    default:
      return assertNever(predicate);
  }
}

function namesRemovedOption(predicate: Predicate, target: ConditionTarget): boolean {
  const known = new Set(
    target.kind === 'choice' || target.kind === 'multi' ? target.options.map((o) => o.id) : [],
  );
  return optionIdsOf(predicate).some((id) => !known.has(id));
}

/** The first thing wrong with one condition, in the order the author would fix them. */
function problemWith(
  condition: Condition,
  owner: Field,
  byId: ReadonlyMap<string, Field>,
  graph: DependencyGraph,
): Problem | null {
  const { predicate } = condition;
  const target = byId.get(condition.targetFieldId);
  // The builder removes these along with the field (D-12), so only stored or hand-edited data
  // can hold one; it is shown, never silently dropped (D6-2, D7-10).
  if (!target) return { control: 'target', text: 'the field it reads was removed' };

  const reads = definitionOf(target).conditionTarget(target);
  if (!reads || reads.kind !== predicate.kind) {
    return { control: 'target', text: 'the field it reads can’t be used in conditions' };
  }
  if (wouldCreateCycle(graph, owner.id, target.id)) {
    return {
      control: 'target',
      text: `it makes a loop, because ${fieldName(target)} already depends on this field`,
    };
  }
  // A missing option would make "does not equal" hold for every answer, so it is never ignored.
  // As with a missing field, only stored data can hold one: removing an option removes these.
  if (namesRemovedOption(predicate, reads)) {
    return { control: 'value', text: 'an option it compares against was removed' };
  }
  if (
    predicate.kind === 'number' &&
    predicate.op === 'between' &&
    predicate.value.min !== null &&
    predicate.value.max !== null &&
    predicate.value.min > predicate.value.max
  ) {
    return { control: 'min', text: 'the first number is more than the second' };
  }
  return isPredicateComplete(predicate) ? null : missingValue(predicate);
}

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

export function conditionIssues(
  owner: Field,
  fields: readonly Field[],
  graph: DependencyGraph,
): ConditionIssue[] {
  const byId = new Map<string, Field>(fields.map((field) => [field.id, field]));
  // Every group the field has, in the order the panel shows them: show, hide, required, not-required.
  return groupsOf(owner.logic).flatMap(({ effect, group }) =>
    group.conditions.flatMap((condition, index) => {
      const problem = problemWith(condition, owner, byId, graph);
      if (!problem) return [];
      return [
        {
          conditionId: condition.id,
          controlId: conditionControlId(condition.id, problem.control),
          message: `${GROUP_COPY[effect].noun} ${index + 1}: ${problem.text}.`,
          detail: sentence(problem.text),
        },
      ];
    }),
  );
}
