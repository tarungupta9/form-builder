import { z } from 'zod';
import type { FormResponse, ResponseValues } from '../domain/response';
import {
  fieldIdSchema,
  fieldValueSchema,
  isoDateTimeSchema,
  responseIdSchema,
  templateIdSchema,
} from '../domain/schemas';
import { type Field, type FormTemplate, groupsOf } from '../domain/template';
import { FIELD_TYPES, definitionOf, fieldRegistry } from '../fields/registry';

/** Every field type's own schema, joined. A new plugin is picked up from the registry. */
export const fieldSchema: z.ZodType<Field> = z.union(
  FIELD_TYPES.map((type) => fieldRegistry[type].schema),
);

/**
 * Invariants the types cannot express. The builder never produces data that breaks them, so a
 * template that does was edited by hand or written by a buggy version, and is not trusted.
 */
function checkTemplateInvariants(fields: readonly Field[], ctx: z.RefinementCtx): void {
  const ids = new Set(fields.map((field) => field.id));
  if (ids.size !== fields.length)
    ctx.addIssue({ code: 'custom', message: 'Two fields share an ID' });
  for (const field of fields) {
    for (const { group } of groupsOf(field.logic)) {
      if (group.conditions.some((condition) => condition.targetFieldId === field.id)) {
        ctx.addIssue({ code: 'custom', message: `Field ${field.id} has a condition on itself` });
      }
    }
  }
}

export const templateSchema: z.ZodType<FormTemplate> = z
  .object({
    id: templateIdSchema,
    title: z.string(),
    description: z.string(),
    fields: z.array(fieldSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .superRefine((template, ctx) => {
    checkTemplateInvariants(template.fields, ctx);
  });

/**
 * Every answer must belong to a field in the snapshot and be a value that field's plugin
 * accepts, so the PDF never meets a Short text holding a list of files.
 */
function checkAnswersFitSnapshot(
  fields: readonly Field[],
  answers: ResponseValues,
  ctx: z.RefinementCtx,
): void {
  // Keyed by plain string, because `Object.entries` gives back the keys unbranded.
  const byId = new Map<string, Field>(fields.map((field) => [field.id, field]));
  for (const [fieldId, value] of Object.entries(answers)) {
    const field = byId.get(fieldId);
    if (!field) {
      ctx.addIssue({ code: 'custom', message: `Answer ${fieldId} has no field in the snapshot` });
    } else if (definitionOf(field).readValue(field, value) === undefined) {
      ctx.addIssue({ code: 'custom', message: `Answer ${fieldId} does not fit its field` });
    }
  }
}

const valuesSchema = z.record(fieldIdSchema, fieldValueSchema);

const draftSchema = z.object({
  status: z.literal('draft'),
  id: responseIdSchema,
  templateId: templateIdSchema,
  values: valuesSchema,
  templateUpdatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

const submittedSchema = z
  .object({
    status: z.literal('submitted'),
    id: responseIdSchema,
    templateId: templateIdSchema,
    createdAt: isoDateTimeSchema,
    submittedAt: isoDateTimeSchema,
    snapshot: z.object({
      title: z.string(),
      description: z.string(),
      fields: z.array(fieldSchema),
    }),
    answers: valuesSchema,
  })
  .superRefine((response, ctx) => {
    checkAnswersFitSnapshot(response.snapshot.fields, response.answers, ctx);
  });

/** Drafts are written from v0.10; their shape is fixed now so stored data never needs migrating. */
export const responseSchema: z.ZodType<FormResponse> = z.discriminatedUnion('status', [
  draftSchema,
  submittedSchema,
]);
