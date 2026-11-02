import { useState } from 'react';
import { useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { usePageTitle } from '../../app/usePageTitle';
import { parseTemplateId } from '../../domain/ids';
import type { DraftResponse } from '../../domain/response';
import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { useCollection, useRepositories, useSetAside } from '../../storage/StorageContext';
import { describeStorageError } from '../../storage/storageMessages';
import type { StorageError } from '../../storage/result';
import { ButtonLink } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FailureAlert } from '../../ui/ErrorSummary';
import { useAnnounce } from '../../ui/LiveRegion';
import { plural } from '../../ui/format';
import { PageHeader } from '../../ui/PageHeader';
import { PRINT_FAILURE, usePdfDownload } from '../export/usePdfDownload';
import { NO_FIELDS_REASON } from '../fill/noFieldsReason';
import { SetAsideNotice } from '../storage-error/SetAsideNotice';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { DraftRow, draftTitleId } from './DraftRow';
import { ResponseRow } from './ResponseRow';
import styles from './Responses.module.css';
import { type TemplateResponseLists, useTemplateResponses } from './useTemplateResponses';

const PAGE_TITLE_ID = 'responses-title';
const LIST_TITLE_ID = 'submitted-responses-title';
const DRAFTS_TITLE_ID = 'in-progress-title';

/**
 * `/templates/:templateId/responses`: a template's responses in progress, which can be resumed
 * or discarded (D-23), then its submitted responses, each one exportable.
 */
export function ResponsesPage() {
  const { templateId: rawId } = useParams();
  const id = rawId === undefined ? null : parseTemplateId(rawId);
  const { templates } = useRepositories();
  const templateSnapshot = useCollection(templates);
  const responses = useTemplateResponses(id);
  const template = id && templateSnapshot.ok ? templateSnapshot.value.get(id) : undefined;

  usePageTitle(
    template
      ? `Responses: ${template.title}`
      : !templateSnapshot.ok
        ? 'Storage problem'
        : 'Page not found',
  );

  if (!templateSnapshot.ok) {
    return <StorageErrorPanel error={templateSnapshot.error} headingLevel={1} />;
  }
  if (!template) return <NotFound />;
  if (!responses.ok) return <StorageErrorPanel error={responses.error} headingLevel={1} />;
  return <ResponsesView template={template} responses={responses.value} />;
}

interface ResponsesViewProps {
  template: FormTemplate;
  responses: TemplateResponseLists;
}

function ResponsesView({ template, responses: lists }: ResponsesViewProps) {
  const { submitted: responses, inProgress } = lists;
  const { responses: responseRepository } = useRepositories();
  const setAside = useSetAside(responseRepository);
  const { busyId, failed, download } = usePdfDownload();
  const discard = useDiscardDraft(inProgress);
  const canRespond = acceptsResponses(template);
  const newResponse = canRespond && (
    <ButtonLink to={`/templates/${template.id}/respond`} variant="primary" icon="plus">
      New response
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title={`Responses to ${template.title}`}
        titleId={PAGE_TITLE_ID}
        actions={
          <>
            {(responses.length > 0 || inProgress.length > 0) && newResponse}
            <ButtonLink to="/" variant="quiet" icon="back">
              All templates
            </ButtonLink>
          </>
        }
      />
      <SetAsideNotice setAside={setAside} noun="response" />
      {failed && <FailureAlert {...PRINT_FAILURE} />}
      {discard.error && <FailureAlert {...describeStorageError(discard.error)} />}
      {inProgress.length > 0 && <InProgress drafts={inProgress} onDiscard={discard.ask} />}
      {responses.length === 0 ? (
        <section
          className={`${styles.empty} ${styles.section}`}
          aria-labelledby="no-responses-title"
        >
          <h2 id="no-responses-title" className={styles.emptyTitle}>
            No responses yet
          </h2>
          <p>Each response submitted to this form appears here, newest first, ready to export.</p>
          {canRespond ? inProgress.length === 0 && newResponse : <p>{NO_FIELDS_REASON}</p>}
        </section>
      ) : (
        <section className={styles.section} aria-labelledby={LIST_TITLE_ID}>
          <h2 id={LIST_TITLE_ID} className={styles.subtitle}>
            {plural(responses.length, 'submitted response')}
          </h2>
          <ol className={styles.list} aria-labelledby={LIST_TITLE_ID}>
            {responses.map((response) => (
              <ResponseRow
                key={response.id}
                response={response}
                busy={busyId === response.id}
                onDownload={() => void download(response)}
              />
            ))}
          </ol>
        </section>
      )}
      {discard.dialog}
    </>
  );
}

/** A draft waiting for the respondent to confirm discarding it. */
interface PendingDiscard {
  draft: DraftResponse;
  /** The neighbouring row, or the page heading, worked out when the dialog opened. */
  focusAfter: string;
  open: boolean;
}

/**
 * Discarding a draft asks first, because its answers cannot be brought back. The dialog is
 * kept mounted by the page, not the In progress list: discarding the last draft removes the
 * list, and the dialog still has to move focus to the page heading as it closes.
 */
function useDiscardDraft(drafts: readonly DraftResponse[]) {
  const { responses } = useRepositories();
  const announce = useAnnounce();
  const [pending, setPending] = useState<PendingDiscard | null>(null);
  const [error, setError] = useState<StorageError | null>(null);

  const ask = (draft: DraftResponse) => {
    setError(null);
    const index = drafts.indexOf(draft);
    const neighbour = drafts[index + 1] ?? drafts[index - 1];
    setPending({
      draft,
      focusAfter: neighbour ? draftTitleId(neighbour) : PAGE_TITLE_ID,
      open: true,
    });
  };
  const close = () => {
    setPending((current) => current && { ...current, open: false });
  };
  const confirm = () => {
    if (!pending) return;
    const removed = responses.remove([pending.draft.id]);
    close();
    if (removed.ok) announce('Discarded the response in progress.');
    else setError(removed.error);
  };

  const dialog = (
    <ConfirmDialog
      open={pending?.open ?? false}
      title="Discard this response?"
      confirmLabel="Discard response"
      fallbackFocusId={pending?.focusAfter ?? PAGE_TITLE_ID}
      onCancel={close}
      onConfirm={confirm}
    >
      <p>Its answers will be deleted. This can’t be undone.</p>
    </ConfirmDialog>
  );
  return { ask, error, dialog };
}

interface InProgressProps {
  drafts: readonly DraftResponse[];
  onDiscard: (draft: DraftResponse) => void;
}

/**
 * Responses started but not submitted (D-23). They are not responses yet, so they are listed
 * apart and never exported: a PDF carries a submission timestamp.
 */
function InProgress({ drafts, onDiscard }: InProgressProps) {
  return (
    <section className={styles.section} aria-labelledby={DRAFTS_TITLE_ID}>
      <h2 id={DRAFTS_TITLE_ID} className={styles.subtitle}>
        In progress
      </h2>
      <ul className={styles.list} aria-labelledby={DRAFTS_TITLE_ID}>
        {drafts.map((draft) => (
          <DraftRow
            key={draft.id}
            draft={draft}
            onDiscard={() => {
              onDiscard(draft);
            }}
          />
        ))}
      </ul>
    </section>
  );
}
