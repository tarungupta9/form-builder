import { useEffect, useRef } from 'react';
import type { TemplateId } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import { Button, ButtonLink } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { formatDateTime } from '../../ui/format';
import { PRINT_FAILURE, usePdfDownload } from '../export/usePdfDownload';
import styles from './Fill.module.css';

/** Why a template cannot be filled in yet (D-20). The card shows the same reason. */
export const NO_FIELDS_REASON = 'Add a field in the builder to collect responses.';

export function NoFieldsNotice({ templateId }: { templateId: TemplateId }) {
  return (
    <section className={styles.notice} aria-labelledby="no-fields-title">
      <h2 id="no-fields-title" className={styles.noticeTitle}>
        This form has no fields yet
      </h2>
      <p>{NO_FIELDS_REASON}</p>
      <ButtonLink to={`/templates/${templateId}/edit`} variant="secondary" icon="edit">
        Open in builder
      </ButtonLink>
    </section>
  );
}

interface SubmittedNoticeProps {
  response: SubmittedResponse;
  onFillAnother: () => void;
}

/**
 * Shown in place of the form after submit. Its heading takes focus, so the outcome is heard.
 * The response can be downloaded from here straight away, and from the responses list later.
 */
export function SubmittedNotice({ response, onFillAnother }: SubmittedNoticeProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { busyId, failed, download } = usePdfDownload();
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className={styles.notice} aria-labelledby="submitted-title">
      <h2 id="submitted-title" ref={heading} tabIndex={-1} className={styles.noticeTitle}>
        Response submitted
      </h2>
      <p>
        Submitted{' '}
        <time dateTime={response.submittedAt}>{formatDateTime(response.submittedAt)}</time>.
      </p>
      {failed && <FailureAlert {...PRINT_FAILURE} />}
      <div className={styles.noticeActions}>
        <Button
          variant="primary"
          icon="download"
          busy={busyId === response.id}
          onClick={() => void download(response)}
        >
          Download PDF
        </Button>
        <Button variant="secondary" onClick={onFillAnother}>
          Fill in another response
        </Button>
        <ButtonLink to={`/templates/${response.templateId}/responses`} variant="quiet">
          View all responses
        </ButtonLink>
      </div>
    </section>
  );
}
