import { useState } from 'react';
import type { SubmittedResponse } from '../../domain/response';
import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { ButtonLink } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { useFocusRequest } from '../../ui/useFocusRequest';
import styles from './Fill.module.css';
import { FillForm } from './FillForm';
import { NoFieldsNotice, SubmittedNotice } from './notices';
import { useSaveResponse } from './useSaveResponse';

const TITLE_ID = 'fill-title';

/**
 * One visit to a template's form: the form, then the confirmation once it is submitted.
 * The confirmation replaces the form on the same URL; refreshing then gives a blank form,
 * which is right, because the response is already stored.
 */
export function ResponseSession({ template }: { template: FormTemplate }) {
  const save = useSaveResponse();
  const focusLater = useFocusRequest();
  const [submitted, setSubmitted] = useState<SubmittedResponse | null>(null);
  // Bumped to start a fresh, empty form after a submission.
  const [round, setRound] = useState(0);

  const body = !acceptsResponses(template) ? (
    <NoFieldsNotice templateId={template.id} />
  ) : submitted ? (
    <SubmittedNotice
      response={submitted}
      onFillAnother={() => {
        setSubmitted(null);
        setRound((count) => count + 1);
        focusLater(TITLE_ID);
      }}
    />
  ) : (
    <FillForm
      key={round}
      template={template}
      onSubmit={(response) => {
        const saved = save(response);
        if (saved.ok) setSubmitted(response);
        return saved;
      }}
    />
  );

  return (
    <>
      <PageHeader
        title={template.title}
        titleId={TITLE_ID}
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
