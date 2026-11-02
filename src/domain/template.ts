import type { ConditionId, FieldId, IsoDate, IsoDateTime, OptionId, TemplateId } from './ids';
import type {
  ChoiceValue,
  DateValue,
  FilesValue,
  MultiValue,
  NumberValue,
  TextValue,
} from './response';

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

/** One choice of a single or multi select. Answers store the ID, so a rename keeps them (D-11). */
export interface Option {
  id: OptionId;
  label: string;
}

/** Decimal places a Number field accepts and a calculation shows. */
export type Decimals = 0 | 1 | 2 | 3 | 4;

export interface TextConfig {
  placeholder: string;
  minLength?: number;
  maxLength?: number;
  prefix: string;
  suffix: string;
}

export interface TextareaConfig {
  placeholder: string;
  minLength?: number;
  maxLength?: number;
  /** How tall the box starts, 1 to 30 rows. */
  rows: number;
}

export interface NumberConfig {
  min?: number;
  max?: number;
  /** More decimal places than this is an error, never silently rounded (D-15). */
  decimals: Decimals;
  prefix: string;
  suffix: string;
}

export interface DateConfig {
  /** Each new response starts with today's local date (D-16). */
  prefillToday: boolean;
  minDate?: IsoDate;
  maxDate?: IsoDate;
}

/** Three looks for one control: they share the value and the validation (HLD §7). */
export type SingleSelectDisplay = 'radio' | 'dropdown' | 'tiles';

export interface SingleSelectConfig {
  /** Array order is the order respondents see. */
  options: Option[];
  display: SingleSelectDisplay;
}

export interface MultiSelectConfig {
  options: Option[];
  /** Applies once something is ticked; `0` or unset means no minimum. */
  minSelections?: number;
  maxSelections?: number;
}

/** XL to XS, which are heading levels `h2` to `h6` (D-18). */
export type SectionSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

export interface SectionConfig {
  size: SectionSize;
}

export interface FileConfig {
  /**
   * Normalised when the author types them (D-17): lower-case extensions with a leading dot
   * (".pdf") or MIME types and wildcards ("image/*"). Empty allows any file.
   */
  allowedTypes: string[];
  /** Unset means no limit. */
  maxFiles?: number;
}

export type Aggregation = 'sum' | 'average' | 'min' | 'max';

export interface CalculationConfig {
  /** Number fields only, never another calculation; in form order. */
  sourceFieldIds: FieldId[];
  aggregation: Aggregation;
  /** Decimal places the result is rounded to and shown with. */
  decimals: Decimals;
}

// ---------------------------------------------------------------------------------------------
// The field union
// ---------------------------------------------------------------------------------------------

/**
 * One entry per field type: its config, its value and which logic axes it has. Adding a field
 * type means adding one entry here; the `Field` union, `FieldOf<K>` and `FieldValueOf<K>` all
 * follow from it.
 *
 * Keys follow the palette order, which is also where each later slice inserts its types, so
 * slices built side by side merge mechanically: text, textarea, number, date (v0.4),
 * singleSelect, multiSelect (v0.5), section (v0.4), then file and calculation (v0.9).
 */
export interface FieldTypeMap {
  text: { config: TextConfig; value: TextValue; logic: InputFieldLogic };
  textarea: { config: TextareaConfig; value: TextValue; logic: InputFieldLogic };
  number: { config: NumberConfig; value: NumberValue; logic: InputFieldLogic };
  date: { config: DateConfig; value: DateValue; logic: InputFieldLogic };
  singleSelect: { config: SingleSelectConfig; value: ChoiceValue; logic: InputFieldLogic };
  multiSelect: { config: MultiSelectConfig; value: MultiValue; logic: InputFieldLogic };
  /** Display only: it holds no value (`never`) and has no required axis. */
  section: { config: SectionConfig; value: never; logic: FieldLogic };
  file: { config: FileConfig; value: FilesValue; logic: InputFieldLogic };
  /** Display only and derived (ADR 0018): its value is computed, never typed, and never required. */
  calculation: { config: CalculationConfig; value: NumberValue; logic: FieldLogic };
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

/** A field that takes an answer, so it has the required axis. */
export type InputField = Extract<Field, { logic: InputFieldLogic }>;

/**
 * Narrows the field itself, not only its logic, so code that writes the field back keeps the
 * narrowing: `{ ...field, logic: { ...field.logic, defaultRequired } }` then type-checks for
 * every input type, and display-only types (section header, calculation) join the union with
 * no change to the caller.
 */
export const takesAnswer = (field: Field): field is InputField => hasRequiredAxis(field.logic);

/**
 * The field with some of its visibility settings replaced, keeping its own type, so the
 * builder can edit visibility on any field without knowing whether it has a required axis.
 */
export function withVisibility<F extends Field>(field: F, change: Partial<FieldLogic>): F {
  return { ...field, logic: { ...field.logic, ...change } };
}

/**
 * The field with each of its condition groups passed through `change`, keeping its own type, so
 * code that edits every group (the D-12 reference cascade) never needs to know which groups a
 * field has. Display-only fields have Show and Hide; input fields also Require and Not required.
 */
export function mapGroups<F extends Field>(
  field: F,
  change: (group: ConditionGroup, effect: Effect) => ConditionGroup,
): F {
  const { logic } = field;
  const show = change(logic.show, 'show');
  const hide = change(logic.hide, 'hide');
  if (!hasRequiredAxis(logic)) return { ...field, logic: { ...logic, show, hide } };
  const require = change(logic.require, 'require');
  const unrequire = change(logic.unrequire, 'unrequire');
  return { ...field, logic: { ...logic, show, hide, require, unrequire } };
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

/** A template can be saved with no fields, but there is nothing to fill in until it has one (D-20). */
export const acceptsResponses = (template: Pick<FormTemplate, 'fields'>): boolean =>
  template.fields.length > 0;
