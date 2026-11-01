import { newFieldId } from '../../domain/ids';
import type { SectionSize } from '../../domain/template';
import { responseSchema, templateSchema } from '../../storage/schemas';
import {
  isoDate,
  sectionField,
  submittedResponse,
  template,
  text,
  textField,
} from '../../test/fixtures';
import { definitionFor } from '../registry';
import { sectionDefinition } from './definition';

describe('Section header definition', () => {
  it('creates an extra-large header with no required setting, which passes its own schema', () => {
    const field = sectionDefinition.create(newFieldId());

    expect(field.config.size).toBe('xl');
    expect('defaultRequired' in field.logic).toBe(false);
    expect(sectionDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('exports as a section heading, XL to XS mapping to levels 2 to 6 (D-18)', () => {
    const levels = (['xl', 'lg', 'md', 'sm', 'xs'] as SectionSize[]).map((size) =>
      sectionDefinition.toExport(sectionField('Trip', size), undefined),
    );

    expect(levels).toEqual(
      [2, 3, 4, 5, 6].map((level) => ({ kind: 'section', text: 'Trip', level })),
    );
  });

  it('holds no value, starts empty, and is never invalid, even when asked as required', () => {
    const field = sectionField();
    // Called as shared code calls it: through the registry, for a field of any type.
    const definition = definitionFor('section');

    expect(definition.readValue(field, text('anything'))).toBeUndefined();
    expect(definition.initialValue(field, isoDate('2026-11-01'))).toBeUndefined();
    expect(sectionDefinition.validateValue(field, undefined, true)).toBeNull();
  });

  it('has no settings that block Save', () => {
    expect(sectionDefinition.validateConfig(sectionField(), { fields: [] })).toEqual([]);
  });

  describe('storage', () => {
    it('loads a stored template that contains a section header', () => {
      expect(templateSchema.safeParse(template([sectionField(), textField()])).success).toBe(true);
    });

    it('drops a required setting hand-written into a stored section header', () => {
      const header = {
        ...sectionField(),
        logic: { ...sectionField().logic, defaultRequired: true },
      };
      const parsed = templateSchema.safeParse({ ...template([]), fields: [header] });
      expect(parsed.success && parsed.data.fields[0]).not.toHaveProperty('logic.defaultRequired');
    });

    it('rejects a stored response with an answer for a section header', () => {
      const header = sectionField();
      const response = submittedResponse(template([header]), { [header.id]: text('Hello') });
      expect(responseSchema.safeParse(response).success).toBe(false);
    });
  });
});
