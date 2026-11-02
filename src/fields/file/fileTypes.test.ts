import {
  describeFile,
  describeFileTypes,
  fileKind,
  formatFileSize,
  isAllowedFile,
  normaliseFileTypes,
} from './fileTypes';

describe('file types (D-17)', () => {
  it('normalises what the author types to extensions and MIME patterns, without duplicates', () => {
    expect(normaliseFileTypes('PDF, .JPG; png  image/*, .pdf, ., ')).toEqual([
      '.pdf',
      '.jpg',
      '.png',
      'image/*',
    ]);
  });

  it('allows anything when no types are set', () => {
    expect(isAllowedFile({ name: 'notes.exe', type: '' }, [])).toBe(true);
  });

  it('matches by extension whatever its case, by exact MIME type, and by MIME wildcard', () => {
    expect(isAllowedFile({ name: 'Receipt.PDF', type: '' }, ['.pdf'])).toBe(true);
    expect(isAllowedFile({ name: 'scan', type: 'image/png' }, ['image/*'])).toBe(true);
    expect(isAllowedFile({ name: 'doc', type: 'application/pdf' }, ['application/pdf'])).toBe(true);
  });

  it('refuses a file whose name and type match none of the allowed types', () => {
    expect(isAllowedFile({ name: 'notes.txt', type: 'text/plain' }, ['.pdf', 'image/*'])).toBe(
      false,
    );
    // A name that only contains the extension is not a match.
    expect(isAllowedFile({ name: 'pdf-notes.txt', type: 'text/plain' }, ['.pdf'])).toBe(false);
  });

  it('describes the allowed types for people', () => {
    expect(describeFileTypes(['.pdf'])).toBe('PDF');
    expect(describeFileTypes(['.pdf', '.jpg', 'image/*'])).toBe('PDF, JPG or image files');
  });

  it('sizes files in B, KB and MB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(12_288)).toBe('12 KB');
    expect(formatFileSize(2_516_582)).toBe('2.4 MB');
  });

  it('names a file’s kind by its extension, or its MIME subtype when it has none', () => {
    expect(fileKind({ name: 'receipt.pdf', type: 'application/pdf' })).toBe('PDF');
    expect(fileKind({ name: 'scan', type: 'image/png' })).toBe('PNG');
    expect(fileKind({ name: 'scan', type: '' })).toBe('File');
  });

  it('describes one file as the export lists it', () => {
    expect(describeFile({ name: 'hotel.pdf', size: 2_516_582, type: 'application/pdf' })).toBe(
      'hotel.pdf · 2.4 MB · PDF',
    );
  });
});
