import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { KEEP_FOCUS } from '../../app/navigation';
import { type ResponseId, toIsoDateTime } from '../../domain/ids';
import type { DraftResponse, SubmittedResponse } from '../../domain/response';
import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { describeStorageError } from '../../storage/storageMessages';
import { ButtonLink } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { PageHeader } from '../../ui/PageHeader';
import { restoreValues, templateChangedSince } from './draft';
import styles from './Fill.module.css';
import { FillForm } from './FillForm';
import { NoFieldsNotice, SubmittedNotice, TemplateChangedNotice } from './notices';
import type { FormStart } from './useFormRuntime';
import { useDraftAutosave } from './useDraftAutosave';
import { useSaveResponse } from './useSaveResponse';

interface ResponseSessionProps {
  /** The template as it was when the session opened (D-10). */
  template: FormTemplate;
  /** The response being written: a new ID, or the resumed draft's. */
  responseId: ResponseId;
  /** The stored draft being resumed, or `null` for a new response. */
  draft: DraftResponse | null;
}

/**
 * One response being filled in: the form, then the confirmation once it is submitted.
 *
 * The session owns the draft (D-23), so the form itself stays free of storage and Preview never
 * writes one (ADR 0016). The first input stores the draft and replaces the URL with the draft's
 * own, so a refresh resumes it; submitting stores the response under the same ID, so the same
 * URL then opens it read-only.
 */
export function ResponseSession({ template, responseId, draft }: ResponseSessionProps) {
  const navigate = useNavigate();
  const save = useSaveResponse();
  const [submitted, setSubmitted] = useState<SubmittedResponse | null>(null);
  const [start] = useState((): FormStart =>
    draft
      ? {
          responseId,
          startedAt: draft.createdAt,
          values: restoreValues(template.fields, draft.values),
        }
      : { responseId, startedAt: toIsoDateTime(new Date()) },
  );
  const ownUrl = `/templates/${template.id}/responses/${responseId}`;

  const followDraft = useCallback(() => {
    // The same page with a new address, so focus stays in the field being typed into.
    void navigate(ownUrl, { replace: true, state: KEEP_FOCUS });
  }, [navigate, ownUrl]);
  const autosave = useDraftAutosave({
    template,
    responseId,
    startedAt: start.startedAt,
    alreadyStored: draft !== null,
    onCreated: followDraft,
  });

  const body = !acceptsResponses(template) ? (
    <NoFieldsNotice templateId={template.id} />
  ) : submitted ? (
    <SubmittedNotice
      response={submitted}
      onFillAnother={() => {
        // A new address, so the app shell moves focus to the page heading as for any new page.
        void navigate(`/templates/${template.id}/respond`);
      }}
    />
  ) : (
    <>
      {draft && templateChangedSince(draft, template) && <TemplateChangedNotice />}
      {autosave.error && (
        <FailureAlert
          title="Your progress isn’t being saved"
          body={`${describeStorageError(autosave.error).body} Your answers are still on screen and can be submitted.`}
        />
      )}
      <FillForm
        template={template}
        start={start}
        onValuesChange={autosave.save}
        onSubmit={(response) => {
          const saved = save(response);
          if (saved.ok) {
            autosave.stop();
            setSubmitted(response);
            // Whether or not a draft existed, the response's own URL now opens it read-only.
            void navigate(ownUrl, { replace: true, state: KEEP_FOCUS });
          }
          return saved;
        }}
      />
    </>
  );

  return (
    <>
      <PageHeader
        title={template.title}
        actions={
          <ButtonLink to="/" variant="quiet" icon="back">
            All templates
          </ButtonLink>
        }
      >
        {template.description && <p className={styles.description}>{template.description}</p>}
      </PageHeader>
      {body}
    </>
  );
}
