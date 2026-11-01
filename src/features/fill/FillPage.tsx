import { useState } from 'react';
import { useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { usePageTitle } from '../../app/usePageTitle';
import { parseTemplateId } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { ResponseSession } from './ResponseSession';

/**
 * `/templates/:templateId/respond`.
 *
 * The template is kept as it was when the page opened, even if it is saved or deleted in
 * another tab meanwhile. Following it live would move, rename or remove fields under the
 * respondent's cursor, and the stored snapshot must be exactly the form they saw (D-10).
 */
export function FillPage() {
  const { templateId: rawId } = useParams();
  const id = rawId === undefined ? null : parseTemplateId(rawId);
  const { templates } = useRepositories();
  const snapshot = useCollection(templates);
  const stored = id && snapshot.ok ? snapshot.value.get(id) : undefined;

  const [opened, setOpened] = useState<FormTemplate | undefined>(stored);
  // A different template in the URL (or one that loads late) is a new form to open.
  if (stored && opened?.id !== stored.id) setOpened(stored);
  const template = opened && opened.id === id ? opened : undefined;

  usePageTitle(
    template
      ? `New response: ${template.title}`
      : !snapshot.ok
        ? 'Storage problem'
        : 'Page not found',
  );

  if (template) return <ResponseSession key={template.id} template={template} />;
  if (!snapshot.ok) return <StorageErrorPanel error={snapshot.error} headingLevel={1} />;
  return <NotFound />;
}
