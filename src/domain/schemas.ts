/**
 * zod schemas for the shared parts of the data model. Everything read from `localStorage` is
 * untrusted (hand edits, old versions, other tabs), so it is parsed with these before use, and
 * branded IDs are minted only after the shape has been checked.
 *
 * Field configs are not here: each field type owns its config schema in its plugin folder.
 */
import { z } from 'zod';
import {
  parseConditionId,
  parseFieldId,
  parseIsoDate,
  parseIsoDateTime,
  parseOptionId,
  parseResponseId,
  parseTemplateId,
} from './ids';
import type { FieldValue, FileMeta } from './response';
import type {
  Condition,
  ConditionGroup,
  Decimals,
  FieldLogic,
  InputFieldLogic,
  Option,
  Predicate,
} from './template';

/** A string schema that only yields a branded value when `parse` accepts it. */
function branded<B>(parse: (raw: string) => B | null, name: string) {
  return z.string().transform((raw, ctx): B => {
    const value = parse(raw);
    if (value === null) {
      ctx.addIssue({ code: 'custom', message: `Invalid ${name}` });
      return z.NEVER;
    }
    return value;
  });
}

export const templateIdSchema = branded(parseTemplateId, 'template ID');
export const fieldIdSchema = branded(parseFieldId, 'field ID');
export const optionIdSchema = branded(parseOptionId, 'option ID');
export const conditionIdSchema = branded(parseConditionId, 'condition ID');
export const responseIdSchema = branded(parseResponseId, 'response ID');
export const isoDateSchema = branded(parseIsoDate, 'date');
export const isoDateTimeSchema = branded(parseIsoDateTime, 'timestamp');

const count = z.number().int().nonnegative();
export const optionalCount = count.optional();

/** How many decimal places a Number (v0.4) or a calculation (v0.9) shows and accepts. */
export const decimalsSchema: z.ZodType<Decimals> = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/** One choice of a single or multi select (v0.5). Answers store its ID, never its label (D-11). */
export const optionSchema: z.ZodType<Option> = z.object({ id: optionIdSchema, label: z.string() });

const nullableNumber = z.number().nullable();

export const predicateSchema: z.ZodType<Predicate> = z.union([
  z.object({
    kind: z.literal('text'),
    op: z.enum(['equals', 'notEquals', 'contains']),
    value: z.string(),
  }),
  z.object({
    kind: z.literal('number'),
    op: z.enum(['equals', 'gt', 'lt']),
    value: nullableNumber,
  }),
  z.object({
    kind: z.literal('number'),
    op: z.literal('between'),
    value: z.object({ min: nullableNumber, max: nullableNumber }),
  }),
  z.object({
    kind: z.literal('choice'),
    op: z.enum(['equals', 'notEquals']),
    value: optionIdSchema.nullable(),
  }),
  z.object({
    kind: z.literal('multi'),
    op: z.enum(['containsAny', 'containsAll', 'containsNone']),
    value: z.array(optionIdSchema),
  }),
  z.object({
    kind: z.literal('date'),
    op: z.enum(['equals', 'before', 'after']),
    value: isoDateSchema.nullable(),
  }),
]);

export const conditionSchema: z.ZodType<Condition> = z.object({
  id: conditionIdSchema,
  targetFieldId: fieldIdSchema,
  predicate: predicateSchema,
});

export const conditionGroupSchema: z.ZodType<ConditionGroup> = z.object({
  match: z.enum(['all', 'any']),
  conditions: z.array(conditionSchema),
});

/**
 * Every field can be shown or hidden. Display-only fields (section header, calculation) use
 * this schema as it is; fields that take an answer extend it with the required axis, so the
 * two cannot drift apart.
 */
export const fieldLogicSchema = z.object({
  defaultVisible: z.boolean(),
  show: conditionGroupSchema,
  hide: conditionGroupSchema,
}) satisfies z.ZodType<FieldLogic>;

export const inputFieldLogicSchema = fieldLogicSchema.extend({
  defaultRequired: z.boolean(),
  require: conditionGroupSchema,
  unrequire: conditionGroupSchema,
}) satisfies z.ZodType<InputFieldLogic>;

export const fileMetaSchema: z.ZodType<FileMeta> = z.object({
  name: z.string(),
  size: count,
  type: z.string(),
  lastModified: z.number(),
});

/**
 * Every kind of answer. Whether a value fits the field it answers is the field's plugin's call
 * (`readValue`), checked where both are known: in the response schema.
 */
export const fieldValueSchema: z.ZodType<FieldValue> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), value: z.string() }),
  z.object({ kind: z.literal('number'), input: z.string() }),
  z.object({ kind: z.literal('date'), value: isoDateSchema.nullable() }),
  z.object({ kind: z.literal('choice'), value: optionIdSchema.nullable() }),
  z.object({ kind: z.literal('multi'), value: z.array(optionIdSchema) }),
  z.object({ kind: z.literal('files'), value: z.array(fileMetaSchema) }),
]);

/**
 * The common shape of every field, with the config schema and logic schema of one type.
 * Each plugin builds its own field schema with this.
 */
export function fieldSchemaOf<T extends string, C, L>(
  type: T,
  config: z.ZodType<C>,
  logic: z.ZodType<L>,
) {
  return z.object({ id: fieldIdSchema, type: z.literal(type), label: z.string(), config, logic });
}
