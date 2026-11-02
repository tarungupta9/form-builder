import { z } from 'zod';
import type { IsoDate } from '../../domain/ids';
import { fieldSchemaOf, inputFieldLogicSchema, isoDateSchema } from '../../domain/schemas';
import { type DateConfig, defaultInputLogic } from '../../domain/template';
import type { FieldDefinition } from '../contract';
import { formatIsoDate } from '../shared/format';
import { EMPTY_EXPORT, answerBlock, nameOf, valueOfKind } from '../shared/helpers';
import { capitalise } from '../shared/textRules';

const configSchema = z.object({
  prefillToday: z.boolean(),
  minDate: isoDateSchema.optional(),
  maxDate: isoDateSchema.optional(),
});

/** An earliest date after the latest leaves no day to choose. The same day for both is one day. */
export const dateRangeIssue = ({ minDate, maxDate }: DateConfig): string | null =>
  minDate && maxDate && minDate > maxDate ? 'The earliest date is after the latest date.' : null;

// `YYYY-MM-DD` strings compare in calendar order, so no `Date` is needed (D-16).
const isInRange = (date: IsoDate, { minDate, maxDate }: DateConfig): boolean =>
  (!minDate || date >= minDate) && (!maxDate || date <= maxDate);

export const dateDefinition: FieldDefinition<'date'> = {
  type: 'date',
  paletteLabel: 'Date',
  icon: 'date',
  schema: fieldSchemaOf('date', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'date',
    label: '',
    config: { prefillToday: false },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) => (config.prefillToday ? 'Date, starts as today' : 'Date'),
  validateConfig: ({ config }) => [dateRangeIssue(config)].filter((issue) => issue !== null),

  readValue: (_field, value) => valueOfKind(value, 'date'),
  // `today` is the respondent's local calendar day, so a form opened at 00:05 starts on that
  // day, not on yesterday's UTC date (D-16). A today outside the allowed range is not filled
  // in: the field would open with an answer that fails on submit.
  initialValue: (field, today) =>
    field.config.prefillToday && isInRange(today, field.config)
      ? { kind: 'date', value: today }
      : undefined,
  validateValue: (field, value, required) => {
    const date = value?.value ?? null;
    if (date === null) return required ? `Enter a date for ${nameOf(field)}` : null;
    const { minDate, maxDate } = field.config;
    if (minDate && date < minDate)
      return `${capitalise(nameOf(field))} must be on or after ${formatIsoDate(minDate)}`;
    if (maxDate && date > maxDate)
      return `${capitalise(nameOf(field))} must be on or before ${formatIsoDate(maxDate)}`;
    return null;
  },
  toExport: (field, value) =>
    answerBlock(
      field,
      value?.value ? { kind: 'text', text: formatIsoDate(value.value) } : EMPTY_EXPORT,
    ),
  conditionTarget: () => ({ kind: 'date' }),
};
