import type { ConditionId, FieldId, IsoDate, IsoDateTime, OptionId, TemplateId } from './ids';
import type { TextValue } from './response';

export interface FormTemplate {
  id: TemplateId;
  title: string;
  /** Plain text, `''` means none (D-32). */
  description: string;
  /** Array order is form order. */
  fields: Field[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------------------------
// Conditions (D-1): one flat group per effect, each with its own AND / OR.
// ---------------------------------------------------------------------------------------------

/**
 * Operators are grouped by the kind of value they read, not by field type, so a future field
 * whose value is text gets the text operators without any change to the rules engine.
 *
 * A `null` (or empty) comparison value means the builder has not finished the condition. It
 * never holds, and the builder blocks Save until it is filled in.
 */
export type Predicate =
  | { kind: 'text'; op: 'equals' | 'notEquals' | 'contains'; value: string }
  | { kind: 'number'; op: 'equals' | 'gt' | 'lt'; value: number | null }
  | { kind: 'number'; op: 'between'; value: { min: number | null; max: number | null } }
  | { kind: 'choice'; op: 'equals' | 'notEquals'; value: OptionId | null }
  | { kind: 'multi'; op: 'containsAny' | 'containsAll' | 'containsNone'; value: OptionId[] }
  | { kind: 'date'; op: 'equals' | 'before' | 'after'; value: IsoDate | null };

export type PredicateKind = Predicate['kind'];
export type PredicateOf<K extends PredicateKind> = Extract<Predicate, { kind: K }>;

export interface Condition {
  id: ConditionId;
  /** The field whose value is read. Never the field that owns the condition. */
  targetFieldId: FieldId;
  predicate: Predicate;
}

export interface ConditionGroup {
  match: 'all' | 'any';
  conditions: Condition[];
}

/** Every field can be shown or hidden. */
export interface FieldLogic {
  defaultVisible: boolean;
  show: ConditionGroup;
  hide: ConditionGroup;
}

/**
 * Fields that capture a value can also be made required or optional. Display-only fields
 * (section header, calculation) have no required axis, and the type says so.
 */
export interface InputFieldLogic extends FieldLogic {
  /** The spec's "Required toggle". */
  defaultRequired: boolean;
  require: ConditionGroup;
  unrequire: ConditionGroup;
}

export type VisibilityEffect = 'show' | 'hide';
export type RequiredEffect = 'require' | 'unrequire';
export type Effect = VisibilityEffect | RequiredEffect;

// ---------------------------------------------------------------------------------------------
// Field configs
// ---------------------------------------------------------------------------------------------

export interface TextConfig {
  placeholder: string;
  minLength?: number;
  maxLength?: number;
  prefix: string;
  suffix: string;
}

// ---------------------------------------------------------------------------------------------
// The field union
// ---------------------------------------------------------------------------------------------

/**
 * One entry per field type: its config, its value and which logic axes it has. Adding a field
 * type means adding one entry here; the `Field` union, `FieldOf<K>` and `FieldValueOf<K>` all
 * follow from it.
 */
export interface FieldTypeMap {
  text: { config: TextConfig; value: TextValue; logic: InputFieldLogic };
}

export type FieldType = keyof FieldTypeMap;

/** Distributes over a union of `K`, so `FieldOf<FieldType>` is exactly `Field`. */
export type FieldOf<K extends FieldType> = K extends FieldType
  ? {
      id: FieldId;
      type: K;
      label: string;
      config: FieldTypeMap[K]['config'];
      logic: FieldTypeMap[K]['logic'];
    }
  : never;

export type Field = FieldOf<FieldType>;
export type FieldValueOf<K extends FieldType> = FieldTypeMap[K]['value'];

export function hasRequiredAxis(logic: FieldLogic): logic is InputFieldLogic {
  return 'defaultRequired' in logic;
}

export const emptyGroup = (): ConditionGroup => ({ match: 'all', conditions: [] });

export const defaultFieldLogic = (): FieldLogic => ({
  defaultVisible: true,
  show: emptyGroup(),
  hide: emptyGroup(),
});

export const defaultInputLogic = (): InputFieldLogic => ({
  ...defaultFieldLogic(),
  defaultRequired: false,
  require: emptyGroup(),
  unrequire: emptyGroup(),
});

/** Every condition group a field has, with the effect each one carries. */
export function groupsOf(logic: FieldLogic): { effect: Effect; group: ConditionGroup }[] {
  const groups: { effect: Effect; group: ConditionGroup }[] = [
    { effect: 'show', group: logic.show },
    { effect: 'hide', group: logic.hide },
  ];
  if (hasRequiredAxis(logic)) {
    groups.push(
      { effect: 'require', group: logic.require },
      { effect: 'unrequire', group: logic.unrequire },
    );
  }
  return groups;
}
