/**
 * The condition groups the builder edits, and the fixed control IDs each condition's inputs
 * carry, so a Save issue can move focus to the exact control it is about.
 */
import type { ConditionId } from '../../../domain/ids';
import type { VisibilityEffect } from '../../../domain/template';

/**
 * Visibility only in v0.6. The require and not-require groups join in v0.7: the engine already
 * resolves them, and the group editor is generic, so they are two more entries here.
 */
export const EDITABLE_EFFECTS = ['show', 'hide'] as const satisfies readonly VisibilityEffect[];
export type EditableEffect = (typeof EDITABLE_EFFECTS)[number];

export interface GroupCopy {
  /** The fieldset's legend. */
  title: string;
  /** The start of the group's sentence: "Show this field when [all] of these match". */
  lead: string;
  /** How one condition is named in labels, announcements and issues: "Show condition 2". */
  noun: string;
}

export const GROUP_COPY: Record<EditableEffect, GroupCopy> = {
  show: { title: 'Show conditions', lead: 'Show this field when', noun: 'Show condition' },
  hide: { title: 'Hide conditions', lead: 'Hide this field when', noun: 'Hide condition' },
};

export type ConditionControl = 'target' | 'operator' | 'value' | 'min' | 'max';

/** Condition IDs are unique across the template, so these never clash between fields. */
export const conditionControlId = (conditionId: ConditionId, control: ConditionControl): string =>
  `condition-${conditionId}-${control}`;
