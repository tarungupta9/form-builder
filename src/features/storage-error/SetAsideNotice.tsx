import type { SetAside } from '../../storage/collection';
import { plural } from '../../ui/format';
import styles from './StorageErrorPanel.module.css';

interface SetAsideNoticeProps {
  setAside: readonly SetAside[];
  /** What the collection holds, in the singular: "template", "response". */
  noun: string;
}

/**
 * Says that some stored items could not be read and were set aside, so the rest could load,
 * and where the copy of the stored data is (ADR 0012). Nothing renders when nothing was set aside.
 */
export function SetAsideNotice({ setAside, noun }: SetAsideNoticeProps) {
  if (setAside.length === 0) return null;
  const count = setAside.reduce((total, entry) => total + entry.count, 0);
  const titleId = `set-aside-${noun}`;
  return (
    <section className={styles.notice} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.noticeTitle}>
        {plural(count, `saved ${noun}`)} could not be read
      </h2>
      <p>
        {count === 1 ? 'It was' : 'They were'} set aside so everything else could load. Nothing was
        deleted: a copy of the stored data is in this browser’s storage under{' '}
        {setAside.length === 1 ? 'the key' : 'the keys'}{' '}
        {setAside.map((entry, index) => (
          <span key={entry.backupKey}>
            {index > 0 && ', '}
            <code>{entry.backupKey}</code>
          </span>
        ))}
        .
      </p>
    </section>
  );
}
