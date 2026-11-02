import { z } from 'zod';
import { fieldSchemaOf, inputFieldLogicSchema } from '../../domain/schemas';
import { type FileConfig, defaultInputLogic } from '../../domain/template';
import { plural } from '../../ui/format';
import type { FieldDefinition } from '../contract';
import { EMPTY_EXPORT, answerBlock, nameOf, valueOfKind } from '../shared/helpers';
import { describeFile, describeFileTypes, isAllowedFile } from './fileTypes';

const configSchema = z.object({
  allowedTypes: z.array(z.string()),
  maxFiles: z.number().int().min(1).optional(),
});

/** Under the answer in the export, because a PDF cannot carry the files themselves (spec §7). */
export const FILE_EXPORT_NOTE =
  'Attachments are listed by name only; file contents are not included in this export.';

/** "PDF or JPG, up to 2 files." for the respondent's hint. */
export function fileHint({ allowedTypes, maxFiles }: FileConfig): string {
  const types = allowedTypes.length > 0 ? describeFileTypes(allowedTypes) : 'Any type of file';
  return maxFiles === undefined ? `${types}.` : `${types}, up to ${plural(maxFiles, 'file')}.`;
}

/**
 * Files stay on the respondent's device: only each file's name, size and type are kept. Allowed
 * types are checked when files are chosen (the renderer) and again on submit (here), because
 * `accept` is only a hint to the picker (D-17).
 */
export const fileDefinition: FieldDefinition<'file'> = {
  type: 'file',
  paletteLabel: 'File upload',
  icon: 'fileUpload',
  schema: fieldSchemaOf('file', configSchema, inputFieldLogicSchema),

  create: (id) => ({
    id,
    type: 'file',
    label: '',
    config: { allowedTypes: [] },
    logic: defaultInputLogic(),
  }),
  summarize: ({ config }) =>
    [
      'File upload',
      config.allowedTypes.length > 0 && describeFileTypes(config.allowedTypes),
      config.maxFiles !== undefined && `up to ${plural(config.maxFiles, 'file')}`,
    ]
      .filter(Boolean)
      .join(', '),
  validateConfig: () => [],

  readValue: (_field, value) => valueOfKind(value, 'files'),
  initialValue: () => undefined,
  validateValue: (field, value, required) => {
    const files = value?.value ?? [];
    if (files.length === 0) return required ? `Add a file for ${nameOf(field)}` : null;
    const { maxFiles, allowedTypes } = field.config;
    if (maxFiles !== undefined && files.length > maxFiles)
      return `Add no more than ${plural(maxFiles, 'file')} for ${nameOf(field)}`;
    const wrongType = files.find((file) => !isAllowedFile(file, allowedTypes));
    if (wrongType) return `${wrongType.name} must be ${describeFileTypes(allowedTypes)}`;
    return null;
  },
  toExport: (field, value) => {
    const files = value?.value ?? [];
    if (files.length === 0) return answerBlock(field, EMPTY_EXPORT);
    return {
      ...answerBlock(field, { kind: 'list', items: files.map(describeFile) }),
      note: FILE_EXPORT_NOTE,
    };
  },
  // The spec's operator table has no row for files, so no condition can read one.
  conditionTarget: () => null,
};
