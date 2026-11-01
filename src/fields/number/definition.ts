import { z } from 'zod';
import { assertNever } from '../../domain/assertNever';
import { decimalsSchema, fieldSchemaOf, inputFieldLogicSchema } from '../../domain/schemas';
import { type Decimals, type NumberConfig, defaultInputLogic } from '../../domain/template';
import { parseDecimal } from '../../domain/values';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { formatNumber, withAdornments } from '../shared/format';
import { EMPTY_EXPORT, answerBlock, nameOf, rangeIssue, valueOfKind } from '../shared/helpers';
import { capitalise } from '../shared/textRules';

const configSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  decimals: decimalsSchema,
  prefix: z.string(),
  suffix: z.string(),
});

/** "like 24.50" for two decimals, "like 24" for none: an example in the shape we expect. */
const example = (decimals: Decimals): string =>
  decimals === 0 ? '24' : `24.${'5'.padEnd(decimals, '0')}`;

/** Decimal places in a configured limit, as the author would have typed it (0.25 → 2). */
const decimalsIn = (value: number): number => String(value).split('.')[1]?.length ?? 0;

/**
 * A limit with more decimals than answers may have would quietly move the real limit: with
 * whole numbers and a minimum of 0.5, the smallest answer allowed is actually 1.
 */
function limitPrecisionIssues({ min, max, decimals }: NumberConfig): string[] {
  const issues: string[] = [];
  if (min !== undefined && decimalsIn(min) > decimals)
    issues.push('The minimum has more decimal places than this field allows.');
  if (max !== undefined && decimalsIn(max) > decimals)
    issues.push('The maximum has more decimal places than this field allows.');
  return issues;
}

/** The problems with the minimum, for the setting beside it. */
export const minimumIssue = (config: NumberConfig): string | null =>
  rangeIssue(config.min, config.max, 'value')[0] ??
  limitPrecisionIssues({ ...config, max: undefined })[0] ??
  null;

/** The problem with the maximum, for the setting beside it. */
export const maximumIssue = (config: NumberConfig): string | null =>
  limitPrecisionIssues({ ...config, min: undefined })[0] ?? null;

export const numberDefinition: FieldDefinition<'number'> = {
  type: 'number',
  paletteLabel: 'Number',
  icon: 'number',
  schema: fieldSchemaOf('number', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'number',
    label: '',
    config: { decimals: 0, prefix: '', suffix: '' },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) =>
    [
      'Number',
      config.decimals === 0 ? 'whole numbers' : plural(config.decimals, 'decimal place'),
      config.prefix && `starts “${config.prefix}”`,
      config.suffix && `ends “${config.suffix}”`,
    ]
      .filter(Boolean)
      .join(', '),
  validateConfig: ({ config }) => [
    ...rangeIssue(config.min, config.max, 'value'),
    ...limitPrecisionIssues(config),
  ],

  readValue: (_field, value) => valueOfKind(value, 'number'),
  initialValue: () => undefined,
  validateValue: (field, value, required) => {
    const name = nameOf(field);
    const { decimals, min, max } = field.config;
    // `parseDecimal` refuses exponents ("1e3") and thousands separators ("1,000"), which
    // `Number()` would accept or misread.
    const parsed = parseDecimal(value?.input ?? '');
    switch (parsed.status) {
      case 'empty':
        return required ? `Enter a number for ${name}` : null;
      case 'invalid':
        return `Enter a number for ${name}, like ${example(decimals)}`;
      case 'ok':
        // Extra decimals are an error rather than silently rounded away (D-15).
        if (parsed.decimals > decimals) {
          return decimals === 0
            ? `Enter a whole number for ${name}`
            : `Use up to ${plural(decimals, 'decimal place')} for ${name}`;
        }
        if (min !== undefined && parsed.value < min)
          return `${capitalise(name)} must be ${min} or more`;
        if (max !== undefined && parsed.value > max)
          return `${capitalise(name)} must be ${max} or less`;
        return null;
      default:
        return assertNever(parsed);
    }
  },
  toExport: (field, value) => {
    const parsed = parseDecimal(value?.input ?? '');
    if (parsed.status !== 'ok') return answerBlock(field, EMPTY_EXPORT);
    const { decimals, prefix, suffix } = field.config;
    return answerBlock(field, {
      kind: 'text',
      text: withAdornments(formatNumber(parsed.value, decimals), prefix, suffix),
    });
  },
};
