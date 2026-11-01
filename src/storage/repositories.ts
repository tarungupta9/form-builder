import type { ResponseId, TemplateId } from '../domain/ids';
import type { FormResponse } from '../domain/response';
import type { FormTemplate } from '../domain/template';
import { type Collection, createCollection } from './collection';
import { responseSchema, templateSchema } from './schemas';

/**
 * One collection key per kind of entity, rather than one key per entity or one key for
 * everything: the templates list is one read, response counts are one read, and saving a
 * template never re-serialises the responses. See ADR 0007 for the trade-off.
 */
export const STORAGE_KEYS = {
  templates: 'formBuilder:v1:templates',
  responses: 'formBuilder:v1:responses',
} as const;

export interface Repositories {
  templates: Collection<TemplateId, FormTemplate>;
  responses: Collection<ResponseId, FormResponse>;
}

export function createRepositories(storage: Storage | null): Repositories {
  return {
    templates: createCollection({
      storage,
      key: STORAGE_KEYS.templates,
      itemSchema: templateSchema,
      idOf: (template) => template.id,
    }),
    responses: createCollection({
      storage,
      key: STORAGE_KEYS.responses,
      itemSchema: responseSchema,
      idOf: (response) => response.id,
    }),
  };
}

/** `localStorage`, or `null` where the browser blocks it (some private modes throw on access). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
