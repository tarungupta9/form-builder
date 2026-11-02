import { z } from 'zod';
import {
  fieldSchemaOf,
  inputFieldLogicSchema,
  optionSchema,
  optionalCount,
} from '../../domain/schemas';
import { defaultInputLogic } from '../../domain/template';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { EMPTY_EXPORT, answerBlock, nameOf, valueOfKind } from '../shared/helpers';
import { optionListIssues, starterOptions } from '../shared/options';
import { minimumOf, selectionLimitIssues } from './selectionRules';

const configSchema = z.object({
  options: z.array(optionSchema),
  minSelections: optionalCount,
  maxSelections: optionalCount,
});

export const multiSelectDefinition: FieldDefinition<'multiSelect'> = {
  type: 'multiSelect',
  paletteLabel: 'Multi select',
  icon: 'multiChoice',
  schema: fieldSchemaOf('multiSelect', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'multiSelect',
    label: '',
    config: { options: starterOptions() },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) => `Multi select, ${plural(config.options.length, 'option')}`,
  validateConfig: ({ config }) => {
    const limits = selectionLimitIssues(config);
    return [
      ...optionListIssues(config.options),
      ...[limits.min, limits.max].filter((issue) => issue !== null),
    ];
  },

  // A deleted option drops out of the selection instead of lingering as an unknown ID (D-23).
  readValue: (field, value) => {
    const multi = valueOfKind(value, 'multi');
    if (!multi) return undefined;
    const known = new Set(field.config.options.map((option) => option.id));
    return { kind: 'multi', value: multi.value.filter((id) => known.has(id)) };
  },
  initialValue: () => undefined,
  // The limits apply once something is ticked, so an optional field can be left empty (O-17).
  validateValue: (field, value, required) => {
    const count = value?.value.length ?? 0;
    const min = minimumOf(field.config);
    const max = field.config.maxSelections;
    if (count === 0) {
      if (!required) return null;
      return min !== undefined && min > 1
        ? `Choose at least ${plural(min, 'option')} for ${nameOf(field)}`
        : `Choose at least one option for ${nameOf(field)}`;
    }
    if (min !== undefined && count < min)
      return `Choose at least ${plural(min, 'option')} for ${nameOf(field)}`;
    if (max !== undefined && count > max)
      return `Choose no more than ${plural(max, 'option')} for ${nameOf(field)}`;
    return null;
  },
  toExport: (field, value) => {
    const selected = new Set(value?.value ?? []);
    // In option order, not the order they were ticked in, so every response reads the same way.
    const items = field.config.options
      .filter((option) => selected.has(option.id))
      .map((option) => option.label.trim());
    return answerBlock(field, items.length > 0 ? { kind: 'list', items } : EMPTY_EXPORT);
  },
  conditionTarget: ({ config }) => ({ kind: 'multi', options: config.options }),
};
