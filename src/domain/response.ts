import type { FieldId, IsoDate, IsoDateTime, OptionId, ResponseId, TemplateId } from './ids';
import type { Field } from './template';

/**
 * A value tagged with its kind, so the engine, validation and export can narrow it safely and
 * the storage schema can reject a value that does not match its field.
 */
export interface TextValue {
  kind: 'text';
  value: string;
}
/**
 * A number is kept as the text the user typed, so "12a" can be reported as "not a number" and
 * "1.505" as "too many decimals" instead of being silently coerced (D-15). `parseDecimal`
 * turns it into a number wherever one is needed.
 */
export interface NumberValue {
  kind: 'number';
  input: string;
}
export interface DateValue {
  kind: 'date';
  value: IsoDate | null;
}
export interface ChoiceValue {
  kind: 'choice';
  value: OptionId | null;
}
export interface MultiValue {
  kind: 'multi';
  value: OptionId[];
}
export interface FilesValue {
  kind: 'files';
  value: FileMeta[];
}

export type FieldValue =
  TextValue | NumberValue | DateValue | ChoiceValue | MultiValue | FilesValue;
export type ValueKind = FieldValue['kind'];

/** File contents never leave the device; only this metadata is stored. */
export interface FileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export type ResponseValues = Partial<Record<FieldId, FieldValue>>;

export interface DraftResponse {
  status: 'draft';
  id: ResponseId;
  templateId: TemplateId;
  /** Raw input, including the values of fields that are currently hidden (D-9). */
  values: ResponseValues;
  /** The template's `updatedAt` when the draft was started, to tell the user it has changed (D-23). */
  templateUpdatedAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** What the respondent saw, frozen at submission so a re-downloaded PDF never changes (D-10). */
export interface ResponseSnapshot {
  title: string;
  description: string;
  /** Visible fields only, in form order. */
  fields: Field[];
}

export interface SubmittedResponse {
  status: 'submitted';
  id: ResponseId;
  templateId: TemplateId;
  createdAt: IsoDateTime;
  submittedAt: IsoDateTime;
  snapshot: ResponseSnapshot;
  /** Visible fields only, with each calculation's result resolved into a Number value. */
  answers: ResponseValues;
}

export type FormResponse = DraftResponse | SubmittedResponse;
