import { z } from 'zod';
import { fieldSchemaOf, inputFieldLogicSchema, optionalCount } from '../../domain/schemas';
import { defaultInputLogic } from '../../domain/template';
import type { FieldDefinition } from '../contract';
import { EMPTY_EXPORT, answerBlock, valueOfKind } from '../shared/helpers';
import { lengthConfigIssues, validateText } from '../shared/textRules';

const configSchema = z.object({
  placeholder: z.string(),
  minLength: optionalCount,
  maxLength: optionalCount,
  prefix: z.string(),
  suffix: z.string(),
});

export const textDefinition: FieldDefinition<'text'> = {
  type: 'text',
  paletteLabel: 'Short text',
  icon: 'shortText',
  schema: fieldSchemaOf('text', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'text',
    label: '',
    config: { placeholder: '', prefix: '', suffix: '' },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) =>
    [
      'Short text',
      config.prefix && `starts “${config.prefix}”`,
      config.suffix && `ends “${config.suffix}”`,
    ]
      .filter(Boolean)
      .join(', '),
  validateConfig: ({ config }) => lengthConfigIssues(config),

  readValue: (_field, value) => valueOfKind(value, 'text'),
  initialValue: () => undefined,
  validateValue: (field, value, required) => validateText(field, field.config, value, required),
  toExport: (field, value) => {
    const text = value?.value.trim() ?? '';
    if (text === '') return answerBlock(field, EMPTY_EXPORT);
    // The prefix and suffix are part of the answer as the respondent saw it: "https://" + "acme" + ".com".
    return answerBlock(field, {
      kind: 'text',
      text: `${field.config.prefix}${text}${field.config.suffix}`,
    });
  },
};
