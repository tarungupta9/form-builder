/**
 * Who refers to a field or an option through a condition, and the field once those references
 * are gone. The builder uses these to say what deleting a field or an option takes with it, and
 * then to remove exactly that (D-12). Pure, and blind to field types: options are found in the
 * predicate, never by asking which type the target is.
 */
import type { FieldId, OptionId } from '../ids';
import {
  type Condition,
  type Effect,
  type Field,
  type Predicate,
  groupsOf,
  mapGroups,
} from '../template';

/** One field that reads the thing being deleted. */
export interface Dependant {
  field: Field;
  /** Which of its groups read it, and how many conditions in each; v0.9 adds calculation sources. */
  reads: { effect: Effect; count: number }[];
}

/** The option IDs a comparison names; empty for kinds that have no options. */
export function optionIdsOf(predicate: Predicate): OptionId[] {
  if (predicate.kind === 'multi') return predicate.value;
  if (predicate.kind === 'choice' && predicate.value !== null) return [predicate.value];
  return [];
}

/** Every field, in form order, with at least one condition that `matches`. */
function dependantsWhere(
  fields: readonly Field[],
  matches: (condition: Condition) => boolean,
): Dependant[] {
  return fields.flatMap((field) => {
    const reads = groupsOf(field.logic)
      .map(({ effect, group }) => ({ effect, count: group.conditions.filter(matches).length }))
      .filter(({ count }) => count > 0);
    return reads.length > 0 ? [{ field, reads }] : [];
  });
}

/** The field with every condition that `matches` removed; the same object when there is none. */
function without(field: Field, matches: (condition: Condition) => boolean): Field {
  const touched = groupsOf(field.logic).some(({ group }) => group.conditions.some(matches));
  if (!touched) return field;
  return mapGroups(field, (group) => ({
    ...group,
    conditions: group.conditions.filter((condition) => !matches(condition)),
  }));
}

const reads = (fieldId: FieldId) => (condition: Condition) => condition.targetFieldId === fieldId;

const compares = (fieldId: FieldId, optionIds: readonly OptionId[]) => (condition: Condition) =>
  condition.targetFieldId === fieldId &&
  optionIdsOf(condition.predicate).some((id) => optionIds.includes(id));

/**
 * The fields with a condition on `fieldId`. Direct readers only: a field further down a chain
 * keeps its own conditions, which read a field that stays.
 */
export const dependantsOf = (fields: readonly Field[], fieldId: FieldId): Dependant[] =>
  dependantsWhere(fields, reads(fieldId));

/** Removes every condition on `fieldId`, in every group; each group keeps its `match`. */
export const withoutConditionsOn = (field: Field, fieldId: FieldId): Field =>
  without(field, reads(fieldId));

/** The fields with a condition that compares `fieldId`'s answer with `optionId`. */
export const optionDependantsOf = (
  fields: readonly Field[],
  fieldId: FieldId,
  optionId: OptionId,
): Dependant[] => dependantsWhere(fields, compares(fieldId, [optionId]));

/**
 * Removes every condition on `fieldId` that names one of `optionIds`. The whole condition goes,
 * even a multi condition that names other options too: dropping one ID would silently change
 * what "contains all" or "contains none" means (D7-7).
 */
export const withoutConditionsComparing = (
  field: Field,
  fieldId: FieldId,
  optionIds: readonly OptionId[],
): Field => without(field, compares(fieldId, optionIds));

const READ_NOUNS: Record<Effect, string> = {
  show: 'show condition',
  hide: 'hide condition',
  require: 'required condition',
  unrequire: 'not-required condition',
};

/** "1 required condition", "2 show conditions and 1 not-required condition". */
export function describeReads(groups: Dependant['reads']): string {
  const parts = groups.map(
    ({ effect, count }) => `${count} ${READ_NOUNS[effect]}${count === 1 ? '' : 's'}`,
  );
  return parts.length <= 1
    ? parts.join('')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** How many conditions a removal takes with it, across every dependant. */
export const conditionCount = (dependants: readonly Dependant[]): number =>
  dependants.reduce((sum, { reads }) => sum + reads.reduce((n, { count }) => n + count, 0), 0);
