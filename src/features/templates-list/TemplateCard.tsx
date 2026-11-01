import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { Button, ButtonLink } from '../../ui/Button';
import { formatDateTime, plural } from '../../ui/format';
import { NO_FIELDS_REASON } from '../fill/notices';
import styles from './TemplatesPage.module.css';

interface TemplateCardProps {
  template: FormTemplate;
  responseCount: number;
}

/** One template on the home page. Presentational: everything it shows comes from its props. */
export function TemplateCard({ template, responseCount }: TemplateCardProps) {
  // The title tells the cards' buttons apart; the visible words lead the name (WCAG 2.5.3).
  const forTitle = <span className="visually-hidden">: {template.title}</span>;
  const reasonId = `no-fields-${template.id}`;
  const canRespond = acceptsResponses(template);

  return (
    <li className={styles.card}>
      <h2 className={styles.cardTitle}>{template.title}</h2>
      {template.description && <p className={styles.description}>{template.description}</p>}
      <p className={styles.meta}>{plural(template.fields.length, 'field')}</p>
      <p className={styles.meta}>{plural(responseCount, 'response')}</p>
      <p className={styles.meta}>
        Last edited <time dateTime={template.updatedAt}>{formatDateTime(template.updatedAt)}</time>
      </p>
      <div className={styles.actions}>
        {canRespond ? (
          <ButtonLink
            to={`/templates/${template.id}/respond`}
            variant="primary"
            size="sm"
            icon="plus"
          >
            New response{forTitle}
          </ButtonLink>
        ) : (
          // A disabled button cannot take focus, so its reason is visible text, not a tooltip.
          <Button variant="primary" size="sm" icon="plus" disabled aria-describedby={reasonId}>
            New response{forTitle}
          </Button>
        )}
        <ButtonLink to={`/templates/${template.id}/edit`} variant="secondary" size="sm" icon="edit">
          Open in builder{forTitle}
        </ButtonLink>
        {/* Shown at 0 responses too: the empty responses page explains itself (G-11). */}
        <ButtonLink
          to={`/templates/${template.id}/responses`}
          variant="quiet"
          size="sm"
          icon="file"
        >
          View responses{forTitle}
        </ButtonLink>
      </div>
      {!canRespond && (
        <p id={reasonId} className={styles.meta}>
          {NO_FIELDS_REASON}
        </p>
      )}
    </li>
  );
}
