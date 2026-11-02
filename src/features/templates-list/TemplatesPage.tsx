import { useState } from 'react';
import { usePageTitle } from '../../app/usePageTitle';
import type { FormTemplate } from '../../domain/template';
import { useRepositories, useSetAside } from '../../storage/StorageContext';
import { deleteTemplate, responsesOf } from '../../storage/deleteTemplate';
import type { StorageError } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';
import { ButtonLink } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { PageHeader } from '../../ui/PageHeader';
import { plural } from '../../ui/format';
import { useNotify } from '../../ui/Toast';
import { SetAsideNotice } from '../storage-error/SetAsideNotice';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { DeleteTemplateDialog, type PendingDeletion } from './DeleteTemplateDialog';
import { TemplateCard, cardTitleId } from './TemplateCard';
import styles from './TemplatesPage.module.css';
import { NO_RESPONSES, useResponseCounts } from './useResponseCounts';
import { useTemplates } from './useTemplates';

const EMPTY_TITLE_ID = 'empty-title';

/** Home: every template, or a way to make the first one. Templates are deleted from here (D-22). */
export function TemplatesPage() {
  usePageTitle('Templates');
  const repositories = useRepositories();
  const { templates: repository, responses: responseRepository } = repositories;
  const templates = useTemplates();
  const responseCounts = useResponseCounts();
  const templatesSetAside = useSetAside(repository);
  const responsesSetAside = useSetAside(responseRepository);
  const notify = useNotify();
  const [deletion, setDeletion] = useState<PendingDeletion | null>(null);
  const [deleteError, setDeleteError] = useState<StorageError | null>(null);

  const askToDelete = (template: FormTemplate, listed: readonly FormTemplate[]) => {
    setDeleteError(null);
    const index = listed.indexOf(template);
    const neighbour = listed[index + 1] ?? listed[index - 1];
    const responses = responseRepository.snapshot();
    setDeletion({
      template,
      responseCounts: responses.ok ? responsesOf(responses.value, template.id) : NO_RESPONSES,
      focusAfter: neighbour ? cardTitleId(neighbour) : EMPTY_TITLE_ID,
      open: true,
    });
  };

  const closeDeletion = () => {
    setDeletion((pending) => pending && { ...pending, open: false });
  };

  /** The dialog moves focus on close: to the neighbour, or back to the card's menu (ADR 0020). */
  const confirmDeletion = ({ template, responseCounts }: PendingDeletion) => {
    const responseCount = responseCounts.submitted + responseCounts.inProgress;
    const deleted = deleteTemplate(repositories, template.id);
    closeDeletion();
    if (!deleted.ok) {
      setDeleteError(deleted.error);
      return;
    }
    notify(
      responseCount > 0
        ? `Deleted ${template.title} and its ${plural(responseCount, 'response')}.`
        : `Deleted ${template.title}.`,
    );
  };

  if (!templates.ok) {
    return (
      <StorageErrorPanel
        error={templates.error}
        headingLevel={1}
        startAgainLabel="Start again with no templates"
        onStartAgain={() => repository.reset()}
      />
    );
  }

  if (!responseCounts.ok) {
    return (
      <StorageErrorPanel
        error={responseCounts.error}
        headingLevel={1}
        startAgainLabel="Start again with no responses"
        onStartAgain={() => responseRepository.reset()}
      />
    );
  }

  const newTemplate = (
    <ButtonLink to="/templates/new" variant="primary" icon="plus">
      New template
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Templates" actions={templates.value.length > 0 && newTemplate} />
      <SetAsideNotice setAside={templatesSetAside} noun="template" />
      <SetAsideNotice setAside={responsesSetAside} noun="response" />
      {deleteError && <FailureAlert {...describeStorageError(deleteError)} />}
      {templates.value.length === 0 ? (
        <section className={styles.empty} aria-labelledby={EMPTY_TITLE_ID}>
          <h2 id={EMPTY_TITLE_ID} tabIndex={-1} className={styles.emptyTitle}>
            Create your first template
          </h2>
          <p>A template is a form you design once and fill in as many times as you need.</p>
          {newTemplate}
        </section>
      ) : (
        <ul className={styles.grid}>
          {templates.value.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              responseCounts={responseCounts.value.get(template.id) ?? NO_RESPONSES}
              onDelete={(chosen) => {
                askToDelete(chosen, templates.value);
              }}
            />
          ))}
        </ul>
      )}
      <DeleteTemplateDialog
        deletion={deletion}
        onCancel={closeDeletion}
        onConfirm={confirmDeletion}
      />
    </>
  );
}
