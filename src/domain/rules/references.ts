/**
 * Who refers to a field or an option, through a condition or as a calculation source, and the
 * field once those references are gone. The builder uses these to say what deleting a field or
 * an option takes with it, and then to remove exactly that (D-12). Pure, and blind to field
 * types: options are found in the predicate, and sources through `FieldDerivations`, never by
 * asking which type a field is.
 */
import type { FieldId, OptionId } from '../ids';
import { type FieldDerivations, NO_DERIVED_FIELDS } from './derivations';
import {
  type Condition,
  type Effect,
  type Field,
  type Predicate,
  groupsOf,
  mapGroups,
} from '../template';

/** How a dependant reads the thing being deleted: through one of its condition groups, or as a source. */
export type ReadKind = Effect | 'source';

/** One field that reads the thing being deleted. */
export interface Dependant {
  field: Field;
  /** Which of its groups read it, and how many conditions in each, then whether it is a source. */
  reads: { effect: ReadKind; count: number }[];
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
 * The fields with a condition on `fieldId` or that compute their value from it. Direct readers
 * only: a field further down a chain keeps its own conditions, which read a field that stays.
 */
export function dependantsOf(
  fields: readonly Field[],
  fieldId: FieldId,
  derivations: FieldDerivations = NO_DERIVED_FIELDS,
): Dependant[] {
  const byConditions = new Map(
    dependantsWhere(fields, reads(fieldId)).map((dependant) => [dependant.field.id, dependant]),
  );
  return fields.flatMap((field) => {
    const conditionReads = byConditions.get(field.id)?.reads ?? [];
    const sourceReads = derivations.sourcesOf(field).includes(fieldId)
      ? [{ effect: 'source' as const, count: 1 }]
      : [];
    const all = [...conditionReads, ...sourceReads];
    return all.length > 0 ? [{ field, reads: all }] : [];
  });
}

/**
 * Removes every reference to `fieldId`: each condition on it, in every group (each group keeps
 * its `match`), and `fieldId` as a source. A calculation left with no sources then blocks Save
 * through its own config check (D-12).
 */
export const withoutReferencesTo = (
  field: Field,
  fieldId: FieldId,
  derivations: FieldDerivations = NO_DERIVED_FIELDS,
): Field => derivations.withoutSource(without(field, reads(fieldId)), fieldId);

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

const READ_NOUNS: Record<ReadKind, string> = {
  show: 'show condition',
  hide: 'hide condition',
  require: 'required condition',
  unrequire: 'not-required condition',
  source: 'calculation source',
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
  dependants.reduce(
    (sum, { reads }) =>
      sum + reads.reduce((n, { effect, count }) => (effect === 'source' ? n : n + count), 0),
    0,
  );

/** How many calculations lose `fieldId` as a source, across every dependant. */
export const sourceCount = (dependants: readonly Dependant[]): number =>
  dependants.filter(({ reads }) => reads.some(({ effect }) => effect === 'source')).length;
