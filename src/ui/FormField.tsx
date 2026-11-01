import type { ReactNode } from 'react';
import styles from './FormField.module.css';

/**
 * Wires a respondent's control to its label, hint and error, so every field type gets the same
 * semantics: `<label for>`, hint and error through `aria-describedby`, and `aria-invalid`.
 * The control is rendered by the caller with the props handed to `children`.
 */
export interface ControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean;
  'aria-required': boolean;
}

interface FieldTextProps {
  label: string;
  required: boolean;
  hint?: ReactNode;
  error: string | null;
}

const describedBy = (
  id: string,
  hint: ReactNode,
  error: string | null,
  extra?: string,
): string | undefined =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null, extra].filter(Boolean).join(' ') ||
  undefined;

export function RequiredTag() {
  return <span className={styles.required}>Required</span>;
}

/** The label text, falling back to a placeholder so an unlabelled field is still named. */
export const displayLabel = (label: string): string => label.trim() || 'Untitled field';

function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={`${id}-hint`} className={styles.hint}>
      {children}
    </span>
  );
}

function ErrorMessage({ id, error }: { id: string; error: string }) {
  return (
    <p id={`${id}-error`} className={styles.error}>
      <span className="visually-hidden">Error: </span>
      {error}
    </p>
  );
}

interface FormFieldProps extends FieldTextProps {
  id: string;
  /** IDs of extra description elements, such as a prefix or suffix. */
  describedByExtra?: string;
  children: (control: ControlProps) => ReactNode;
}

/** A single control with a `<label>`. */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  describedByExtra,
  children,
}: FormFieldProps) {
  return (
    <div className={[styles.field, error ? styles.invalid : ''].join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {displayLabel(label)}
        {required && <RequiredTag />}
      </label>
      {hint && <Hint id={id}>{hint}</Hint>}
      {error && <ErrorMessage id={id} error={error} />}
      {children({
        id,
        'aria-describedby': describedBy(id, hint, error, describedByExtra),
        'aria-invalid': Boolean(error),
        'aria-required': required,
      })}
    </div>
  );
}

interface FieldsetFieldProps extends FieldTextProps {
  /** Used to derive hint and error IDs; the group's first control should carry `id` itself. */
  id: string;
  children: ReactNode;
}

/** A group of controls (radios, checkboxes, tiles) under a `<legend>`. */
export function FieldsetField({ id, label, required, hint, error, children }: FieldsetFieldProps) {
  return (
    <fieldset
      className={[styles.field, styles.fieldset, error ? styles.invalid : ''].join(' ')}
      aria-describedby={describedBy(id, hint, error)}
    >
      <legend className={styles.label}>
        {displayLabel(label)}
        {required && <RequiredTag />}
      </legend>
      {hint && <Hint id={id}>{hint}</Hint>}
      {error && <ErrorMessage id={id} error={error} />}
      {children}
    </fieldset>
  );
}
