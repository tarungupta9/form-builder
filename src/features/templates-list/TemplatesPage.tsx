import { usePageTitle } from '../../app/usePageTitle';
import { useRepositories } from '../../storage/StorageContext';
import { ButtonLink } from '../../ui/Button';
import { PageHeader } from '../../ui/PageHeader';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { TemplateCard } from './TemplateCard';
import styles from './TemplatesPage.module.css';
import { useTemplates } from './useTemplates';

/** Home: every template, or a way to make the first one. */
export function TemplatesPage() {
  usePageTitle('Templates');
  const { templates: repository } = useRepositories();
  const templates = useTemplates();

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

  const newTemplate = (
    <ButtonLink to="/templates/new" variant="primary" icon="plus">
      New template
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title="Templates" actions={templates.value.length > 0 && newTemplate} />
      {templates.value.length === 0 ? (
        <section className={styles.empty} aria-labelledby="empty-title">
          <h2 id="empty-title" className={styles.emptyTitle}>
            Create your first template
          </h2>
          <p>A template is a form you design once and fill in as many times as you need.</p>
          {newTemplate}
        </section>
      ) : (
        <ul className={styles.grid}>
          {templates.value.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </ul>
      )}
    </>
  );
}
