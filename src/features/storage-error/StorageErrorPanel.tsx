import type { StorageError } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';
import { Button } from '../../ui/Button';
import styles from './StorageErrorPanel.module.css';

interface StorageErrorPanelProps {
  error: StorageError;
  /** The page's heading level, so the panel fits the outline it is placed in. */
  headingLevel: 1 | 2;
  /** Offered only once the unreadable data is safely backed up, since it replaces it. */
  onStartAgain?: () => void;
  startAgainLabel?: string;
}

/** Explains a storage failure in plain words: what happened, and what became of the user's data. */
export function StorageErrorPanel({
  error,
  headingLevel,
  onStartAgain,
  startAgainLabel,
}: StorageErrorPanelProps) {
  const { title, body } = describeStorageError(error);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const backupKey = error.kind === 'corrupt' ? error.backupKey : null;
  return (
    <section className={styles.panel} aria-labelledby="storage-error-title">
      <Heading id="storage-error-title" tabIndex={-1} className={styles.title}>
        {title}
      </Heading>
      <p>{body}</p>
      {backupKey && (
        <p>
          The backup is in this browser’s storage under the key <code>{backupKey}</code>.
        </p>
      )}
      {backupKey && onStartAgain && startAgainLabel && (
        <Button variant="secondary" onClick={onStartAgain}>
          {startAgainLabel}
        </Button>
      )}
    </section>
  );
}
