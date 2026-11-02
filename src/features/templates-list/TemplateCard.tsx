import { Link } from 'react-router';
import { type FormTemplate, acceptsResponses } from '../../domain/template';
import { ActionMenu, type ActionMenuItem } from '../../ui/ActionMenu';
import { Button, ButtonLink } from '../../ui/Button';
import { formatDateTime, plural } from '../../ui/format';
import { NO_FIELDS_REASON } from '../fill/noFieldsReason';
import styles from './TemplatesPage.module.css';
import type { ResponseCounts } from './useResponseCounts';

/** The card's title heading, which takes focus when a neighbouring card is deleted. */
export const cardTitleId = (template: FormTemplate): string => `template-title-${template.id}`;

interface TemplateCardProps {
  template: FormTemplate;
  responseCounts: ResponseCounts;
  onDelete: (template: FormTemplate) => void;
}

/**
 * One template on the home page. Presentational: everything it shows comes from its props.
 * New response is the card's one visible action; the rest wait in its menu (ADR 0020).
 * The title itself links to the builder, so clicking a template edits it (spec, Templates list).
 */
export function TemplateCard({ template, responseCounts, onDelete }: TemplateCardProps) {
  // The title tells the cards' buttons apart; the visible words lead the name (WCAG 2.5.3).
  const forTitle = <span className="visually-hidden">: {template.title}</span>;
  const reasonId = `no-fields-${template.id}`;
  const canRespond = acceptsResponses(template);
  const editPath = `/templates/${template.id}/edit`;

  // Item names need no title: the menu is named by its trigger, which carries it.
  const secondaryActions: ActionMenuItem[] = [
    // Kept beside the title link: a menu user finds every destination in one list.
    { kind: 'link', label: 'Open in builder', to: editPath, icon: 'edit' },
    // Shown at 0 responses too: the empty responses page explains itself (G-11).
    {
      kind: 'link',
      label: 'View responses',
      to: `/templates/${template.id}/responses`,
      icon: 'file',
    },
    { kind: 'separator' },
    // On the card only, never in the builder, where it would meet the unsaved-changes guard (D8-9).
    {
      kind: 'action',
      label: 'Delete',
      icon: 'trash',
      tone: 'danger',
      onSelect: () => {
        onDelete(template);
      },
    },
  ];

  return (
    <li className={styles.card}>
      <div className={styles.titleRow}>
        {/* Only the title text is the link, so its name is the title alone and the card's other
            controls are not nested inside it (ADR 0020, option C). The heading keeps the id and
            tabIndex that let it take focus after a neighbouring card is deleted. */}
        <h2 id={cardTitleId(template)} tabIndex={-1} className={styles.cardTitle}>
          <Link to={editPath} className={styles.cardTitleLink}>
            {template.title}
          </Link>
        </h2>
        <ActionMenu label={`More actions for ${template.title}`} items={secondaryActions} />
      </div>
      {template.description && <p className={styles.description}>{template.description}</p>}
      <p className={styles.meta}>{plural(template.fields.length, 'field')}</p>
      <p className={styles.meta}>{describeCounts(responseCounts)}</p>
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
      </div>
      {!canRespond && (
        <p id={reasonId} className={styles.meta}>
          {NO_FIELDS_REASON}
        </p>
      )}
    </li>
  );
}

/** "12 responses · 2 in progress"; drafts are mentioned only when there are some (D-23). */
function describeCounts({ submitted, inProgress }: ResponseCounts): string {
  const responses = plural(submitted, 'response');
  return inProgress > 0 ? `${responses} · ${inProgress} in progress` : responses;
}
