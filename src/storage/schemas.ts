import { z } from 'zod';
import { isoDateTimeSchema, templateIdSchema } from '../domain/schemas';
import { type Field, type FormTemplate, groupsOf } from '../domain/template';
import { FIELD_TYPES, fieldRegistry } from '../fields/registry';

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
