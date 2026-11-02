import { useMemo } from 'react';
import type { SubmittedResponse } from '../../domain/response';
import { Button, ButtonLink } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { toExportModel } from '../export/exportModel';
import { ResponseDocument } from '../export/ResponseDocument';
import { PRINT_FAILURE, usePdfDownload } from '../export/usePdfDownload';
import styles from './Responses.module.css';

/**
 * A submitted response at its own URL, read-only. It is the export model drawn by the same
 * `ResponseDocument` the PDF prints, not the form's inputs made read-only, so what is on
 * screen and what is downloaded cannot disagree, and no renderer needs a read-only mode
 * (ADR 0011, ADR 0019). It reads the response alone, never the template (D-10).
 */
export function SubmittedResponseView({ response }: { response: SubmittedResponse }) {
  const document = useMemo(() => toExportModel(response), [response]);
  const { busyId, failed, download } = usePdfDownload();

  return (
    <>
      <nav aria-label="Response" className={styles.toolbar}>
        <ButtonLink to={`/templates/${response.templateId}/responses`} variant="quiet" icon="back">
          All responses
        </ButtonLink>
        <Button
          variant="secondary"
          icon="download"
          busy={busyId === response.id}
          onClick={() => void download(response)}
        >
          Re-download PDF
        </Button>
      </nav>
      {failed && <FailureAlert {...PRINT_FAILURE} />}
      <ResponseDocument document={document} />
    </>
  );
}
