import { z } from 'zod';
import {
  decimalsSchema,
  fieldIdSchema,
  fieldLogicSchema,
  fieldSchemaOf,
} from '../../domain/schemas';
import {
  type Aggregation,
  type Field,
  type FieldOf,
  defaultFieldLogic,
} from '../../domain/template';
import { numberOf } from '../../domain/values';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { formatNumber } from '../shared/format';
import { answerBlock, valueOfKind } from '../shared/helpers';
import { aggregate } from './aggregate';

const configSchema = z.object({
  sourceFieldIds: z.array(fieldIdSchema),
  aggregation: z.enum(['sum', 'average', 'min', 'max']),
  decimals: decimalsSchema,
});

export const AGGREGATION_NAMES: Record<Aggregation, string> = {
  sum: 'Sum',
  average: 'Average',
  min: 'Minimum',
  max: 'Maximum',
};

/** Only Number fields can be sources, so a calculation never reads another calculation (spec §10). */
export const isNumberField = (field: Field | undefined): field is FieldOf<'number'> =>
  field?.type === 'number';

export const NO_SOURCES = 'Choose at least one Number field to calculate from.';
export const NOT_A_NUMBER_SOURCE = 'Every source must be a Number field in this form.';

/** "Hotel, Meals and Taxi". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/**
 * A read-only result computed from Number fields. Its value is derived by the rules engine
 * through `derivation` (ADR 0018): never typed, never required, and never a condition target,
 * because the spec's operator table has no row for it and keeping it out means a calculation
 * can never sit in a cycle.
 */
export const calculationDefinition: FieldDefinition<'calculation'> = {
  type: 'calculation',
  paletteLabel: 'Calculation',
  icon: 'calculation',
  schema: fieldSchemaOf('calculation', configSchema, fieldLogicSchema),

  create: (id) => ({
    id,
    type: 'calculation',
    label: '',
    config: { sourceFieldIds: [], aggregation: 'sum', decimals: 2 },
    logic: defaultFieldLogic(),
  }),
  summarize: ({ config }) =>
    `Calculation, ${AGGREGATION_NAMES[config.aggregation].toLowerCase()} of ${plural(config.sourceFieldIds.length, 'Number field')}`,
  // D-12: removing a field drops it from the sources; one left with none blocks Save here.
  validateConfig: ({ config }, { fields }) => {
    if (config.sourceFieldIds.length === 0) return [NO_SOURCES];
    const byId = new Map(fields.map((field) => [field.id, field]));
    return config.sourceFieldIds.every((id) => isNumberField(byId.get(id)))
      ? []
      : [NOT_A_NUMBER_SOURCE];
  },

  // The engine writes the result as a Number value; a stored one is only ever read back.
  readValue: (_field, value) => valueOfKind(value, 'number'),
  initialValue: () => undefined,
  validateValue: () => null,
  toExport: (field, value) => {
    const result = numberOf(value);
    return answerBlock(
      field,
      result === null
        ? { kind: 'empty', text: 'Nothing to calculate' }
        : { kind: 'text', text: formatNumber(result, field.config.decimals) },
    );
  },
  conditionTarget: () => null,

  derivation: {
    sourcesOf: (field) => field.config.sourceFieldIds,
    // The same object when untouched, so the canvas's memoised items do not re-render.
    withoutSource: (field, sourceId) =>
      field.config.sourceFieldIds.includes(sourceId)
        ? {
            ...field,
            config: {
              ...field.config,
              sourceFieldIds: field.config.sourceFieldIds.filter((id) => id !== sourceId),
            },
          }
        : field,
    // Effective values only (D6-5): a hidden source is absent, and an empty or unreadable one
    // gives no number, so both are left out and Average divides by the filled sources (D-14).
    derive: (field, effective) => {
      const numbers = field.config.sourceFieldIds
        .map((id) => numberOf(effective[id]))
        .filter((value) => value !== null);
      const result = aggregate(numbers, field.config.aggregation, field.config.decimals);
      return result === null
        ? undefined
        : { kind: 'number', input: result.toFixed(field.config.decimals) };
    },
  },
};
