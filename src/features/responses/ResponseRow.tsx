import type { SubmittedResponse } from '../../domain/response';
import { Button } from '../../ui/Button';
import { formatDateTime } from '../../ui/format';
import styles from './Responses.module.css';

interface ResponseRowProps {
  response: SubmittedResponse;
  /** This response's PDF is being prepared. */
  busy: boolean;
  onDownload: () => void;
}

/** One submitted response in the list. Presentational: what it shows and does comes from props. */
export function ResponseRow({ response, busy, onDownload }: ResponseRowProps) {
  const submitted = formatDateTime(response.submittedAt);
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <p className={styles.when}>
          Submitted <time dateTime={response.submittedAt}>{submitted}</time>
        </p>
        <p className={styles.meta}>
          Response ID <code className={styles.id}>{response.id}</code>
        </p>
      </div>
      <Button variant="secondary" size="sm" icon="download" busy={busy} onClick={onDownload}>
        Re-download PDF
        {/* Tells the rows' buttons apart; the visible words lead the name (WCAG 2.5.3). */}
        <span className="visually-hidden">: submitted {submitted}</span>
      </Button>
    </li>
  );
}
