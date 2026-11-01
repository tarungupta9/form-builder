/**
 * The plugin contract: everything shared code needs to know about a field type, so none of it
 * switches on the type itself. A field type is one folder that implements `FieldDefinition`
 * (pure) and `FieldUi` (React), registered in `registry.ts` and `ui-registry.ts`.
 *
 * The contract grows with the app, one capability per slice: v0.1 covered what the builder and
 * storage need, v0.2 added filling in and validating answers, and v0.3 adds `toExport`, how a
 * field reads in the PDF and the on-screen record of a submitted response.
 *
 * Methods are declared with method syntax on purpose. TypeScript checks method parameters
 * bivariantly, which lets `FieldDefinition<'text'>` be used where `FieldDefinition<FieldType>` is
 * expected; that is how shared code calls a plugin for a `Field` of unknown type without a cast.
 * The registries pair each definition with its own type, so the looser check is safe there.
 */
import type { ReactNode } from 'react';
import type { z } from 'zod';
import type { FieldId, IsoDate } from '../domain/ids';
import type { FieldValue } from '../domain/response';
import type { Field, FieldOf, FieldType, FieldValueOf } from '../domain/template';
import type { IconName } from '../ui/icons';

/** What the builder knows about the whole form while one field is being configured. */
export interface TemplateContext {
  fields: readonly Field[];
}

/**
 * How one answer reads in an export, whatever its field type. This is a closed set of
 * presentation shapes, not of field types: every type maps its value onto one of them inside
 * its own plugin, so the export view never needs to learn about a new type (ADR 0011).
 */
export type ExportValue =
  /** No answer. Reads "Not answered" unless `text` gives a better phrase ("Nothing to calculate"). */
  | { kind: 'empty'; text?: string }
  /** Shown with its line breaks kept, so long text needs no flag of its own. */
  | { kind: 'text'; text: string }
  /** A bulleted list: multi-select labels (v0.5), file metadata lines (v0.9). */
  | { kind: 'list'; items: string[] };

/** `h2` to `h6`: the form title is the document's only `h1` (D-18). */
export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/** One row of an exported document: a section heading or a labelled answer. */
export type ExportBlock =
  | { kind: 'section'; text: string; level: HeadingLevel }
  /** `note` is the plugin's caveat about this answer, shown under it (the file-contents footnote). */
  | { kind: 'answer'; label: string; value: ExportValue; note?: string };

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

  /**
   * Narrows a value of unknown kind to this type's value, or `undefined` when it does not fit
   * the field. Shared code holds answers as `FieldValue`; this is how it hands a plugin its own.
   */
  readValue(field: FieldOf<K>, value: FieldValue | undefined): FieldValueOf<K> | undefined;
  /** The value a new response starts with, such as today's date; `undefined` for none. */
  initialValue(field: FieldOf<K>, today: IsoDate): FieldValueOf<K> | undefined;
  /**
   * The first problem with an answer, phrased for the respondent, or `null` when it is fine.
   * `required` is the field's resolved state (conditions included), not its Required toggle.
   */
  validateValue(
    field: FieldOf<K>,
    value: FieldValueOf<K> | undefined,
    required: boolean,
  ): string | null;

  /**
   * How the field reads in the export: the PDF and the on-screen record of a response. It is
   * called once per field of a response's snapshot, with that field's stored answer, so it
   * must not depend on the template as it is today (D-10).
   */
  toExport(field: FieldOf<K>, value: FieldValueOf<K> | undefined): ExportBlock;
}

export interface RendererProps<K extends FieldType> {
  field: FieldOf<K>;
  value: FieldValueOf<K> | undefined;
  required: boolean;
  error: string | null;
  /** The ID the control must carry, so an error summary link can move focus to it. */
  controlId: string;
  onChange(this: void, value: FieldValueOf<K>): void;
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
  /** The respondent's control in Fill mode, with its label, hint and error. */
  Renderer(this: void, props: RendererProps<K>): ReactNode;
}
