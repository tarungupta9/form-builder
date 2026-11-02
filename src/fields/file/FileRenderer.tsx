import { useState } from 'react';
import type { FileMeta } from '../../domain/response';
import { Button } from '../../ui/Button';
import { FieldsetField, displayLabel } from '../../ui/FormField';
import { plural } from '../../ui/format';
import { Icon } from '../../ui/icons';
import { useAnnounce } from '../../ui/LiveRegion';
import { useFocusRequest } from '../../ui/useFocusRequest';
import type { RendererProps } from '../contract';
import { fileHint } from './definition';
import styles from './FileRenderer.module.css';
import { describeFileTypes, fileKind, formatFileSize, isAllowedFile } from './fileTypes';

const toMeta = (file: File): FileMeta => ({
  name: file.name,
  size: file.size,
  type: file.type,
  lastModified: file.lastModified,
});

/** Why some of the chosen files were not added, or `null` when every one was. */
function refusalOf(
  wrongType: readonly File[],
  overLimit: number,
  allowedTypes: readonly string[],
  maxFiles: number | undefined,
): string | null {
  const problems = [
    wrongType.length > 0 &&
      `${wrongType.map((file) => file.name).join(', ')} ${wrongType.length === 1 ? 'is' : 'are'} not ${describeFileTypes(allowedTypes)}.`,
    overLimit > 0 && `Only ${plural(maxFiles ?? 0, 'file')} can be added.`,
  ].filter((problem) => typeof problem === 'string');
  return problems.length > 0 ? problems.join(' ') : null;
}

/**
 * Each chosen file is checked against the allowed types and the file limit straight away, and
 * anything refused is explained, rather than waiting for submit. `accept` only filters the
 * picker, and the respondent can switch it to "All files", so the check here is the real one
 * (D-17). Only metadata is kept; the file itself never leaves the device.
 */
export function FileRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'file'>) {
  const announce = useAnnounce();
  const focusLater = useFocusRequest();
  const { allowedTypes, maxFiles } = field.config;
  const files = value?.value ?? [];
  const [refusal, setRefusal] = useState<string | null>(null);
  const full = maxFiles !== undefined && files.length >= maxFiles;
  const refusalId = `${controlId}-refusal`;

  const add = (picked: readonly File[]) => {
    const wrongType = picked.filter((file) => !isAllowedFile(file, allowedTypes));
    const allowed = picked.filter((file) => isAllowedFile(file, allowedTypes)).map(toMeta);
    const room = maxFiles === undefined ? allowed.length : Math.max(0, maxFiles - files.length);
    const accepted = allowed.slice(0, room);
    const problem = refusalOf(wrongType, allowed.length - accepted.length, allowedTypes, maxFiles);
    setRefusal(problem);
    if (accepted.length > 0) onChange({ kind: 'files', value: [...files, ...accepted] });
    const added = accepted.length > 0 ? `${plural(accepted.length, 'file')} added.` : null;
    const message = [added, problem].filter(Boolean).join(' ');
    if (message) announce(message);
  };

  return (
    <FieldsetField
      id={controlId}
      label={field.label}
      required={required}
      hint={fileHint(field.config)}
      error={error}
    >
      <div className={[styles.dropzone, error ? styles.invalid : ''].join(' ')}>
        <Icon name="upload" size={24} className={styles.dropIcon} />
        <span className={styles.dropText}>{full ? 'File limit reached.' : 'Add files'}</span>
        <input
          id={controlId}
          type="file"
          className="visually-hidden"
          multiple={maxFiles !== 1}
          accept={allowedTypes.join(',') || undefined}
          disabled={full}
          aria-invalid={Boolean(error)}
          aria-describedby={refusal ? refusalId : undefined}
          onChange={(event) => {
            add([...(event.target.files ?? [])]);
            // Cleared, so choosing the same file again still fires a change.
            event.target.value = '';
          }}
        />
        <label
          htmlFor={controlId}
          className={[styles.choose, full ? styles.chooseDisabled : ''].join(' ')}
        >
          Choose files
        </label>
      </div>
      {refusal && (
        <p id={refusalId} className={styles.refusal}>
          {refusal}
        </p>
      )}
      {files.length > 0 && (
        <ul className={styles.files} aria-label={`Files added to ${displayLabel(field.label)}`}>
          {files.map((file, index) => (
            <li
              key={`${file.name}-${String(file.lastModified)}-${String(index)}`}
              className={styles.file}
            >
              <Icon name="file" size={20} className={styles.fileIcon} />
              <span className={styles.fileText}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileMeta}>
                  {formatFileSize(file.size)}, {fileKind(file)}
                </span>
              </span>
              <Button
                variant="dangerQuiet"
                size="sm"
                onClick={() => {
                  onChange({ kind: 'files', value: files.filter((_, i) => i !== index) });
                  setRefusal(null);
                  announce(`${file.name} removed.`);
                  // The button goes with its file, and the picker may only now be enabled again.
                  focusLater(controlId);
                }}
              >
                Remove<span className="visually-hidden"> {file.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        Only each file's name, size and type are saved with the response. The file itself stays on
        your device.
      </p>
    </FieldsetField>
  );
}
