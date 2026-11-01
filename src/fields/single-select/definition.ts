import { z } from 'zod';
import { fieldSchemaOf, inputFieldLogicSchema, optionSchema } from '../../domain/schemas';
import { type SingleSelectDisplay, defaultInputLogic } from '../../domain/template';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { EMPTY_EXPORT, answerBlock, nameOf, valueOfKind } from '../shared/helpers';
import { optionListIssues, starterOptions } from '../shared/options';

const configSchema = z.object({
  options: z.array(optionSchema),
  display: z.enum(['radio', 'dropdown', 'tiles']),
});

const DISPLAY_NAMES: Record<SingleSelectDisplay, string> = {
  radio: 'radio buttons',
  dropdown: 'a dropdown',
  tiles: 'tiles',
};

export const singleSelectDefinition: FieldDefinition<'singleSelect'> = {
  type: 'singleSelect',
  paletteLabel: 'Single select',
  icon: 'singleChoice',
  schema: fieldSchemaOf('singleSelect', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'singleSelect',
    label: '',
    config: { options: starterOptions(), display: 'radio' },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) =>
    `Single select as ${DISPLAY_NAMES[config.display]}, ${plural(config.options.length, 'option')}`,
  validateConfig: ({ config }) => optionListIssues(config.options),

  // Answers store the option's ID, never its label, so renaming an option keeps them (D-11).
  // An ID the field no longer has, or no choice at all, reads as no answer (D-23).
  readValue: (field, value) => {
    const choice = valueOfKind(value, 'choice');
    return choice && field.config.options.some((option) => option.id === choice.value)
      ? choice
      : undefined;
  },
  initialValue: () => undefined,
  // The display is not consulted: radio, dropdown and tiles share one value and one rule.
  validateValue: (field, value, required) =>
    required && (value?.value ?? null) === null ? `Choose an option for ${nameOf(field)}` : null,
  toExport: (field, value) => {
    const option = field.config.options.find((candidate) => candidate.id === value?.value);
    return answerBlock(field, option ? { kind: 'text', text: option.label.trim() } : EMPTY_EXPORT);
  },
};
