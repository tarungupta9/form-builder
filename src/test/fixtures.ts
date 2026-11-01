/**
 * Small, explicit builders for tests. Each returns a complete, valid object with the defaults a
 * newly added field has, so a test only states what matters to its scenario.
 */
import {
  type FieldId,
  newConditionId,
  newFieldId,
  newTemplateId,
  toIsoDateTime,
} from '../domain/ids';
import {
  type Condition,
  type ConditionGroup,
  type FieldOf,
  type FormTemplate,
  type Predicate,
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
