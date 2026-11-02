import { z } from 'zod';
import { fieldSchemaOf, inputFieldLogicSchema, optionalCount } from '../../domain/schemas';
import { defaultInputLogic } from '../../domain/template';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { EMPTY_EXPORT, answerBlock, valueOfKind } from '../shared/helpers';
import { lengthConfigIssues, validateText } from '../shared/textRules';

export const MIN_ROWS = 1;
export const MAX_ROWS = 30;

const configSchema = z.object({
  placeholder: z.string(),
  minLength: optionalCount,
  maxLength: optionalCount,
  rows: z.number().int().min(MIN_ROWS).max(MAX_ROWS),
});

/** The row count's problem, if any; the editor shows it beside the setting. */
export const rowsIssue = (rows: number): string | null =>
  Number.isInteger(rows) && rows >= MIN_ROWS && rows <= MAX_ROWS
    ? null
    : `Visible rows must be from ${MIN_ROWS} to ${MAX_ROWS}.`;

/** Long text: Short text's answer rules in a multi-line box. Its value is a plain text value. */
export const textareaDefinition: FieldDefinition<'textarea'> = {
  type: 'textarea',
  paletteLabel: 'Long text',
  icon: 'longText',
  schema: fieldSchemaOf('textarea', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'textarea',
    label: '',
    config: { placeholder: '', rows: 4 },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) => `Long text, ${plural(config.rows, 'row')}`,
  // An out-of-range row count blocks Save with a message, rather than being clamped as the
  // author types (typing "40" would silently become 30).
  validateConfig: ({ config }) =>
    [...lengthConfigIssues(config), rowsIssue(config.rows)].filter((issue) => issue !== null),

  readValue: (_field, value) => valueOfKind(value, 'text'),
  initialValue: () => undefined,
  validateValue: (field, value, required) => validateText(field, field.config, value, required),
  // Line breaks inside the answer are kept: the export view always renders text `pre-wrap`.
  toExport: (field, value) => {
    const text = value?.value.trim() ?? '';
    return answerBlock(field, text === '' ? EMPTY_EXPORT : { kind: 'text', text });
  },
  conditionTarget: () => ({ kind: 'text' }),
};
