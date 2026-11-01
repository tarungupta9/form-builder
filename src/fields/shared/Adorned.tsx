import type { ReactNode } from 'react';
import styles from './Answer.module.css';

interface AdornedProps {
  id: string;
  prefix: string;
  suffix: string;
  children: ReactNode;
}

/**
 * Static text before and after a control ("https://", ".com", "$", "kg"). The adornments get
 * IDs so the control can include them in its accessible description (see `adornmentIds`).
 */
export function Adorned({ id, prefix, suffix, children }: AdornedProps) {
  if (!prefix && !suffix) return <>{children}</>;
  return (
    <div className={styles.adorned}>
      {prefix && (
        <span id={`${id}-prefix`} className={styles.adornment}>
          {prefix}
        </span>
      )}
      {children}
      {suffix && (
        <span id={`${id}-suffix`} className={styles.adornment}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export const adornmentIds = (id: string, prefix: string, suffix: string): string | undefined =>
  [prefix ? `${id}-prefix` : null, suffix ? `${id}-suffix` : null].filter(Boolean).join(' ') ||
  undefined;

export const answerStyles = styles;
