import { type ReactNode, useEffect, useId, useState } from 'react';
import type { ControlProps } from './FormField';
import styles from './Setting.module.css';

/**
 * A labelled setting in the builder's config panel. Same wiring as `FormField` (label, hint and
 * error through `aria-describedby`) in the denser look of the builder chrome.
 */
interface SettingProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** A fixed ID for the control, for code that moves focus to it; generated otherwise. */
  id?: string;
  children: (control: ControlProps) => ReactNode;
}

export function Setting({ label, hint, error = null, id: fixedId, children }: SettingProps) {
  const generatedId = useId();
  const id = fixedId ?? generatedId;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.setting}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': Boolean(error),
        'aria-required': false,
      })}
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}

export const controlClass = styles.control;
export const selectClass = [styles.control, styles.select].join(' ');

interface OptionalNumberInputProps extends ControlProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** Whole numbers only (lengths, counts) or any decimal (min / max values). */
  integer?: boolean;
  className?: string;
}

/**
 * A text box for an optional number. It keeps the user's text while they type ("1." or "-")
 * and reports a number, or `undefined` when cleared, only once the text parses.
 */
export function OptionalNumberInput({
  value,
  onChange,
  integer = false,
  className,
  ...control
}: OptionalNumberInputProps) {
  const [text, setText] = useState(value === undefined ? '' : String(value));

  // Follow outside changes (another field selected, undo) without fighting the user's typing.
  useEffect(() => {
    setText((current) =>
      parseOptional(current, integer) === value
        ? current
        : value === undefined
          ? ''
          : String(value),
    );
  }, [value, integer]);

  const invalid = parseOptional(text, integer) === null;
  return (
    <input
      {...control}
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      className={[controlClass, className].filter(Boolean).join(' ')}
      value={text}
      aria-invalid={control['aria-invalid'] || invalid}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const parsed = parseOptional(next, integer);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}

/** `undefined` for empty text, `null` for text that is not a valid number. */
function parseOptional(text: string, integer: boolean): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const pattern = integer ? /^\d+$/ : /^-?(\d+(\.\d+)?|\.\d+)$/;
  return pattern.test(trimmed) ? Number(trimmed) : null;
}
