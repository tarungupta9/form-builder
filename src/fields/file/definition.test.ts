import { newFieldId } from '../../domain/ids';
import { fileField, fileMeta, files } from '../../test/fixtures';
import { FILE_EXPORT_NOTE, fileDefinition } from './definition';

describe('File upload definition', () => {
  it('creates an optional field that allows any file and passes its own schema', () => {
    const field = fileDefinition.create(newFieldId());

    expect(field.config).toEqual({ allowedTypes: [] });
    expect(field.logic.defaultRequired).toBe(false);
    expect(fileDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('rejects a stored field with a file limit below 1', () => {
    expect(fileDefinition.schema.safeParse(fileField('Receipts', { maxFiles: 0 })).success).toBe(
      false,
    );
  });

  it('summarises its types and limit for the canvas', () => {
    expect(
      fileDefinition.summarize(
        fileField('Receipts', { allowedTypes: ['.pdf', '.jpg'], maxFiles: 3 }),
      ),
    ).toBe('File upload, PDF or JPG, up to 3 files');
    expect(fileDefinition.summarize(fileField())).toBe('File upload');
  });

  it('can never be a condition target', () => {
    expect(fileDefinition.conditionTarget(fileField())).toBeNull();
  });

  describe('answers', () => {
    const receipts = fileField('Receipts', { allowedTypes: ['.pdf'], maxFiles: 2 });

    it('asks for a file only when required', () => {
      expect(fileDefinition.validateValue(receipts, undefined, true)).toBe(
        'Add a file for Receipts',
      );
      expect(fileDefinition.validateValue(receipts, files(), false)).toBeNull();
    });

    it('refuses more files than the limit', () => {
      const three = files(fileMeta('a.pdf'), fileMeta('b.pdf'), fileMeta('c.pdf'));
      expect(fileDefinition.validateValue(receipts, three, false)).toBe(
        'Add no more than 2 files for Receipts',
      );
    });

    it('refuses a stored file of a type the field does not allow', () => {
      const wrong = files(fileMeta('notes.txt', 100, 'text/plain'));
      expect(fileDefinition.validateValue(receipts, wrong, false)).toBe('notes.txt must be PDF');
    });

    it('accepts allowed files within the limit', () => {
      expect(fileDefinition.validateValue(receipts, files(fileMeta('a.pdf')), true)).toBeNull();
    });
  });

  describe('export', () => {
    it('lists each file as name, size and type, with the note that contents are not included', () => {
      const value = files(fileMeta('hotel.pdf'), fileMeta('taxi.png', 12_288, 'image/png'));

      expect(fileDefinition.toExport(fileField('Receipts'), value)).toEqual({
        kind: 'answer',
        label: 'Receipts',
        value: { kind: 'list', items: ['hotel.pdf · 2.4 MB · PDF', 'taxi.png · 12 KB · PNG'] },
        note: FILE_EXPORT_NOTE,
      });
      expect(FILE_EXPORT_NOTE).toBe(
        'Attachments are listed by name only; file contents are not included in this export.',
      );
    });

    it('reads as not answered, with no note, when no file was added', () => {
      expect(fileDefinition.toExport(fileField('Receipts'), files())).toEqual({
        kind: 'answer',
        label: 'Receipts',
        value: { kind: 'empty' },
      });
    });
  });
});
