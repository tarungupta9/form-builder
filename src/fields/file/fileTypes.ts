/**
 * The author types allowed file types as free text ("PDF, .jpg, image/*"). They are normalised
 * to lower-case extensions with a leading dot, or MIME patterns, and duplicates dropped (D-17).
 */
export function normaliseFileTypes(text: string): string[] {
  const types = text
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '' && part !== '.')
    .map((part) => (part.includes('/') || part.startsWith('.') ? part : `.${part}`));
  return [...new Set(types)];
}

/**
 * `accept` on the input is only a hint (the user can pick "All files"), so every file is checked
 * again here when it is chosen or dropped.
 */
export function isAllowedFile(
  file: { name: string; type: string },
  allowed: readonly string[],
): boolean {
  if (allowed.length === 0) return true;
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return allowed.some((pattern) => {
    if (pattern.startsWith('.')) return name.endsWith(pattern);
    if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -1));
    return mime === pattern;
  });
}

/** "PDF, JPG or PNG" for hints and messages. */
export function describeFileTypes(allowed: readonly string[]): string {
  const names = allowed.map((pattern) =>
    pattern.startsWith('.') ? pattern.slice(1).toUpperCase() : pattern.replace('/*', ' files'),
  );
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names.at(-1) ?? ''}`;
}

/** The type shown in the PDF: the extension, or the MIME subtype when there is none. */
export function fileKind(file: { name: string; type: string }): string {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  if (extension) return extension.toUpperCase();
  return file.type.split('/')[1]?.toUpperCase() ?? 'File';
}

/** "2.4 MB", "12 KB", "512 B": binary units, one decimal for megabytes. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** One file as the export and the file list show it: "receipt.pdf · 2.4 MB · PDF". */
export const describeFile = (file: { name: string; size: number; type: string }): string =>
  `${file.name} · ${formatFileSize(file.size)} · ${fileKind(file)}`;
