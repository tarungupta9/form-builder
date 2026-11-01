import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

/** An on/off setting: a `<button role="switch">`, labelled by its visible text. */
export function Switch({ label, checked, onChange, description }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <span className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-description` : undefined}
        className={styles.switch}
        onClick={() => {
          onChange(!checked);
        }}
      >
        <span aria-hidden="true" className={styles.thumb} />
      </button>
    </div>
  );
}
