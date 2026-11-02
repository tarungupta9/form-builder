/**
 * The condition groups the builder edits, and the fixed control IDs each condition's inputs
 * carry, so a Save issue can move focus to the exact control it is about.
 */
import type { ConditionId } from '../../../domain/ids';
import type { Effect, RequiredEffect, VisibilityEffect } from '../../../domain/template';

/** The groups the Visibility section edits, on every field. */
export const VISIBILITY_EFFECTS = ['show', 'hide'] as const satisfies readonly VisibilityEffect[];
/** The groups the Required section edits, on fields that take an answer. */
export const REQUIRED_EFFECTS = [
  'require',
  'unrequire',
] as const satisfies readonly RequiredEffect[];

export interface GroupCopy {
  /** The fieldset's legend. */
  title: string;
  /** The start of the group's sentence: "Show this field when [all] of these match". */
  lead: string;
  /** How one condition is named in labels, announcements and issues: "Show condition 2". */
  noun: string;
}

/** The required groups use the spec's own words for the effect: "Mark as required". */
export const GROUP_COPY: Record<Effect, GroupCopy> = {
  show: { title: 'Show conditions', lead: 'Show this field when', noun: 'Show condition' },
  hide: { title: 'Hide conditions', lead: 'Hide this field when', noun: 'Hide condition' },
  require: {
    title: 'Required conditions',
    lead: 'Mark as required when',
    noun: 'Required condition',
  },
  unrequire: {
    title: 'Not-required conditions',
    lead: 'Mark as not required when',
    noun: 'Not-required condition',
  },
};

export type ConditionControl = 'target' | 'operator' | 'value' | 'min' | 'max';

/** Condition IDs are unique across the template, so these never clash between fields. */
export const conditionControlId = (conditionId: ConditionId, control: ConditionControl): string =>
  `condition-${conditionId}-${control}`;
