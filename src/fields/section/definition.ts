import { z } from 'zod';
import { fieldLogicSchema, fieldSchemaOf } from '../../domain/schemas';
import { type SectionSize, defaultFieldLogic } from '../../domain/template';
import type { FieldDefinition, HeadingLevel } from '../contract';

const configSchema = z.object({ size: z.enum(['xl', 'lg', 'md', 'sm', 'xs']) });

/** The form title is the page's `h1`, so the largest section starts at `h2` (D-18). */
export const HEADING_LEVEL: Record<SectionSize, HeadingLevel> = {
  xl: 2,
  lg: 3,
  md: 4,
  sm: 5,
  xs: 6,
};

export const SIZE_NAMES: Record<SectionSize, string> = {
  xl: 'Extra large',
  lg: 'Large',
  md: 'Medium',
  sm: 'Small',
  xs: 'Extra small',
};

/** A heading's words, with a placeholder while the author has not written them yet. */
export const headingText = (label: string): string => label.trim() || 'Untitled section';

/**
 * A heading that splits the form into parts. It asks nothing, so it holds no value, is never
 * required (its logic has no required axis) and is never validated; it still counts as a
 * field on the card (D-19) and prints as a heading in the PDF.
 */
export const sectionDefinition: FieldDefinition<'section'> = {
  type: 'section',
  paletteLabel: 'Section header',
  icon: 'section',
  schema: fieldSchemaOf('section', configSchema, fieldLogicSchema),

  create: (id) => ({
    id,
    type: 'section',
    label: '',
    config: { size: 'xl' },
    logic: defaultFieldLogic(),
  }),
  summarize: ({ config }) => `Section header, ${SIZE_NAMES[config.size].toLowerCase()}`,
  validateConfig: () => [],

  readValue: () => undefined,
  initialValue: () => undefined,
  validateValue: () => null,
  toExport: (field) => ({
    kind: 'section',
    text: headingText(field.label),
    level: HEADING_LEVEL[field.config.size],
  }),
};
