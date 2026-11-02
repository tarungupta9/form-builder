import { useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { usePageTitle } from '../../app/usePageTitle';
import { parseTemplateId } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { useCollection, useRepositories, useSetAside } from '../../storage/StorageContext';
import { ButtonLink } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { plural } from '../../ui/format';
import { PageHeader } from '../../ui/PageHeader';
import { PRINT_FAILURE, usePdfDownload } from '../export/usePdfDownload';
import { NO_FIELDS_REASON } from '../fill/noFieldsReason';
import { SetAsideNotice } from '../storage-error/SetAsideNotice';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { ResponseRow } from './ResponseRow';
import styles from './Responses.module.css';
import { useTemplateResponses } from './useTemplateResponses';

const LIST_TITLE_ID = 'submitted-responses-title';

/** `/templates/:templateId/responses`: a template's submitted responses, each one exportable. */
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
  /** Newest first. */
  responses: readonly SubmittedResponse[];
}

function ResponsesView({ template, responses }: ResponsesViewProps) {
  const { responses: responseRepository } = useRepositories();
  const setAside = useSetAside(responseRepository);
  const { busyId, failed, download } = usePdfDownload();
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
        actions={
          <>
            {responses.length > 0 && newResponse}
            <ButtonLink to="/" variant="quiet" icon="back">
              All templates
            </ButtonLink>
          </>
        }
      />
      <SetAsideNotice setAside={setAside} noun="response" />
      {failed && <FailureAlert {...PRINT_FAILURE} />}
      {responses.length === 0 ? (
        <section className={styles.empty} aria-labelledby="no-responses-title">
          <h2 id="no-responses-title" className={styles.emptyTitle}>
            No responses yet
          </h2>
          <p>Each response submitted to this form appears here, newest first, ready to export.</p>
          {canRespond ? newResponse : <p>{NO_FIELDS_REASON}</p>}
        </section>
      ) : (
        <>
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
        </>
      )}
    </>
  );
}
