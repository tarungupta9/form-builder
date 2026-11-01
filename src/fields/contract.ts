/**
 * The plugin contract: everything shared code needs to know about a field type, so none of it
 * switches on the type itself. A field type is one folder that implements `FieldDefinition`
 * (pure) and `FieldUi` (React), registered in `registry.ts` and `ui-registry.ts`.
 *
 * The contract grows with the app, one capability per slice: this version covers what the
 * builder and storage need. Filling in, validating answers and exporting arrive in later
 * slices as new members, which every registered type must then implement.
 *
 * Methods are declared with method syntax on purpose. TypeScript checks method parameters
 * bivariantly, which lets `FieldDefinition<'text'>` be used where `FieldDefinition<FieldType>` is
 * expected; that is how shared code calls a plugin for a `Field` of unknown type without a cast.
 * The registries pair each definition with its own type, so the looser check is safe there.
 */
import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { FieldId } from '../domain/ids';
import type { Field, FieldOf, FieldType } from '../domain/template';
import type { IconName } from '../ui/icons';

/** What the builder knows about the whole form while one field is being configured. */
export interface TemplateContext {
  fields: readonly Field[];
}

export interface FieldDefinition<K extends FieldType> {
  type: K;
  /** Shown in the palette and as the type name in the config panel. */
  paletteLabel: string;
  icon: IconName;
  /** Boundary validation for a stored field of this type. */
  schema: z.ZodType<FieldOf<K>>;

  /** A new field with sensible defaults, as added from the palette. */
  create(id: FieldId): FieldOf<K>;
  /** One line for the canvas, such as "Short text, starts “https://”". */
  summarize(field: FieldOf<K>): string;
  /** Problems with the type's own settings that block Save, phrased for the form's author. */
  validateConfig(field: FieldOf<K>, context: TemplateContext): string[];
}

export interface EditorProps<K extends FieldType> {
  field: FieldOf<K>;
  context: TemplateContext;
  // Method syntax (bivariant, see above); `this: void` says it is safe to destructure.
  onChange(this: void, next: FieldOf<K>): void;
}

export interface FieldUi<K extends FieldType> {
  /** The type-specific settings in the builder's config panel (label and Required are shared). */
  Editor(this: void, props: EditorProps<K>): ReactNode;
}
