import type { FormTemplate } from '../../domain/template';
import { ButtonLink } from '../../ui/Button';
import { formatDateTime, plural } from '../../ui/format';
import styles from './TemplatesPage.module.css';

/** One template on the home page. Presentational: everything it shows comes from `template`. */
export function TemplateCard({ template }: { template: FormTemplate }) {
  return (
    <li className={styles.card}>
      <h2 className={styles.cardTitle}>{template.title}</h2>
      {template.description && <p className={styles.description}>{template.description}</p>}
      <p className={styles.meta}>{plural(template.fields.length, 'field')}</p>
      <p className={styles.meta}>
        Last edited <time dateTime={template.updatedAt}>{formatDateTime(template.updatedAt)}</time>
      </p>
      <div className={styles.actions}>
        <ButtonLink to={`/templates/${template.id}/edit`} variant="secondary" size="sm" icon="edit">
          {/* The visible words lead the accessible name (WCAG 2.5.3); the title tells cards apart. */}
          Open in builder<span className="visually-hidden">: {template.title}</span>
        </ButtonLink>
      </div>
    </li>
  );
}
