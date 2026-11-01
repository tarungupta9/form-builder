import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: string;
  /** Lets a page move focus back to its heading, such as after starting a form again. */
  titleId?: string;
  /** A control that acts on the title itself, such as an edit button, shown right after it. */
  titleAction?: ReactNode;
  /** Actions on the right, such as a primary button. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * The page's `<h1>` and its actions. The heading takes `tabIndex={-1}` so the app shell can move
 * focus to it after a navigation without adding it to the Tab order.
 */
export function PageHeader({ title, titleId, titleAction, actions, children }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        <div className={styles.titleRow}>
          <h1 id={titleId} tabIndex={-1} className={styles.title}>
            {title}
          </h1>
          {titleAction}
        </div>
        {children}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
