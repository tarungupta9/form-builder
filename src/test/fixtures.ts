/**
 * Small, explicit builders for tests. Each returns a complete, valid object with the defaults a
 * newly added field has, so a test only states what matters to its scenario.
 */
import {
  type FieldId,
  type IsoDate,
  type OptionId,
  newConditionId,
  newFieldId,
  newOptionId,
  newResponseId,
  newTemplateId,
  parseIsoDate,
  toIsoDateTime,
} from '../domain/ids';
import type {
  ChoiceValue,
  DateValue,
  MultiValue,
  NumberValue,
  ResponseValues,
  SubmittedResponse,
  TextValue,
} from '../domain/response';
import {
  type Condition,
  type ConditionGroup,
  type FieldOf,
  type FormTemplate,
  type Option,
  type Predicate,
  defaultFieldLogic,
  defaultInputLogic,
} from '../domain/template';

export const textField = (
  label = 'Name',
  overrides: Partial<FieldOf<'text'>> = {},
): FieldOf<'text'> => ({
  id: newFieldId(),
  type: 'text',
  label,
  config: { placeholder: '', prefix: '', suffix: '' },
  logic: defaultInputLogic(),
  ...overrides,
});

export const textareaField = (
  label = 'Notes',
  overrides: Partial<FieldOf<'textarea'>> = {},
): FieldOf<'textarea'> => ({
  id: newFieldId(),
  type: 'textarea',
  label,
  config: { placeholder: '', rows: 4 },
  logic: defaultInputLogic(),
  ...overrides,
});

/** Options with fresh IDs, one per label, in the order given. */
export const options = (...labels: string[]): Option[] =>
  labels.map((label) => ({ id: newOptionId(), label }));

export const singleSelectField = (
  label = 'Payment method',
  overrides: Partial<FieldOf<'singleSelect'>> = {},
): FieldOf<'singleSelect'> => ({
  id: newFieldId(),
  type: 'singleSelect',
  label,
  config: { options: options('Card', 'Cash', 'Invoice'), display: 'radio' },
  logic: defaultInputLogic(),
  ...overrides,
});

export const multiSelectField = (
  label = 'Expense types',
  overrides: Partial<FieldOf<'multiSelect'>> = {},
): FieldOf<'multiSelect'> => ({
  id: newFieldId(),
  type: 'multiSelect',
  label,
  config: { options: options('Travel', 'Meals', 'Lodging', 'Other') },
  logic: defaultInputLogic(),
  ...overrides,
});

export const numberField = (
  label = 'Amount',
  config: Partial<FieldOf<'number'>['config']> = {},
): FieldOf<'number'> => ({
  id: newFieldId(),
  type: 'number',
  label,
  config: { decimals: 0, prefix: '', suffix: '', ...config },
  logic: defaultInputLogic(),
});

export const dateField = (
  label = 'Date of travel',
  config: Partial<FieldOf<'date'>['config']> = {},
): FieldOf<'date'> => ({
  id: newFieldId(),
  type: 'date',
  label,
  config: { prefillToday: false, ...config },
  logic: defaultInputLogic(),
});

export const sectionField = (
  label = 'Trip details',
  size: FieldOf<'section'>['config']['size'] = 'xl',
): FieldOf<'section'> => ({
  id: newFieldId(),
  type: 'section',
  label,
  config: { size },
  logic: defaultFieldLogic(),
});

export const condition = (targetFieldId: FieldId, predicate: Predicate): Condition => ({
  id: newConditionId(),
  targetFieldId,
  predicate,
});

export const group = (
  match: ConditionGroup['match'],
  ...conditions: Condition[]
): ConditionGroup => ({
  match,
  conditions,
});

export const template = (fields: FormTemplate['fields'], title = 'Expense claim'): FormTemplate => {
  const now = toIsoDateTime(new Date('2026-10-31T14:05:00Z'));
  return { id: newTemplateId(), title, description: '', fields, createdAt: now, updatedAt: now };
};

// Values, as a renderer would produce them.
export const text = (value: string): TextValue => ({ kind: 'text', value });
export const num = (input: string): NumberValue => ({ kind: 'number', input });
export const choice = (value: OptionId | null): ChoiceValue => ({ kind: 'choice', value });
export const multi = (...value: OptionId[]): MultiValue => ({ kind: 'multi', value });
export const date = (raw: string): DateValue => ({ kind: 'date', value: isoDate(raw) });

export function isoDate(raw: string): IsoDate {
  const parsed = parseIsoDate(raw);
  if (!parsed) throw new Error(`Not a calendar date: ${raw}`);
  return parsed;
}

/**
 * A submitted response to `form`, answered with `answers`, snapshotting every field.
 * `overrides` sets anything else a scenario depends on, such as when it was submitted.
 */
export const submittedResponse = (
  form: FormTemplate,
  answers: ResponseValues = {},
  overrides: Partial<SubmittedResponse> = {},
): SubmittedResponse => {
  const at = toIsoDateTime(new Date('2026-11-01T09:30:00Z'));
  return {
    status: 'submitted',
    id: newResponseId(),
    templateId: form.id,
    createdAt: at,
    submittedAt: at,
    // A copy, as at submit, so editing the template afterwards leaves the snapshot alone.
    snapshot: { title: form.title, description: form.description, fields: [...form.fields] },
    answers,
    ...overrides,
  };
};
