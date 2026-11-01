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
  parseTemplateId,
} from './ids';
import type { Condition, ConditionGroup, InputFieldLogic, Predicate } from './template';

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
export const isoDateSchema = branded(parseIsoDate, 'date');
export const isoDateTimeSchema = branded(parseIsoDateTime, 'timestamp');

const count = z.number().int().nonnegative();
export const optionalCount = count.optional();

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

export const inputFieldLogicSchema: z.ZodType<InputFieldLogic> = z.object({
  defaultVisible: z.boolean(),
  show: conditionGroupSchema,
  hide: conditionGroupSchema,
  defaultRequired: z.boolean(),
  require: conditionGroupSchema,
  unrequire: conditionGroupSchema,
});

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
