import type { DraftResponse } from '../../domain/response';
import { Button, ButtonLink } from '../../ui/Button';
import { formatDateTime } from '../../ui/format';
import styles from './Responses.module.css';

/** The row's text, which takes focus when the draft next to it is discarded. */
export const draftTitleId = (draft: DraftResponse): string => `draft-${draft.id}`;

interface DraftRowProps {
  draft: DraftResponse;
  onDiscard: () => void;
}

/** One response in progress. Presentational: what it shows and does comes from props. */
export function DraftRow({ draft, onDiscard }: DraftRowProps) {
  const edited = formatDateTime(draft.updatedAt);
  // Tells the rows' controls apart; the visible words lead the name (WCAG 2.5.3).
  const forRow = <span className="visually-hidden">: last edited {edited}</span>;
  return (
    <li className={styles.row}>
      <p id={draftTitleId(draft)} tabIndex={-1} className={styles.when}>
        Last edited <time dateTime={draft.updatedAt}>{edited}</time>
      </p>
      <div className={styles.rowActions}>
        <ButtonLink
          to={`/templates/${draft.templateId}/responses/${draft.id}`}
          variant="secondary"
          size="sm"
          icon="edit"
        >
          Resume{forRow}
        </ButtonLink>
        <Button variant="dangerQuiet" size="sm" icon="trash" onClick={onDiscard}>
          Discard{forRow}
        </Button>
      </div>
    </li>
  );
}
