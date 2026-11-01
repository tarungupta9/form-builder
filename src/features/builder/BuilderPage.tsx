import { useState } from 'react';
import { useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { usePageTitle } from '../../app/usePageTitle';
import { newTemplateId, parseTemplateId, toIsoDateTime } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { Builder } from './Builder';

function blankTemplate(): FormTemplate {
  const now = toIsoDateTime(new Date());
  return {
    id: newTemplateId(),
    title: '',
    description: '',
    fields: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * `/templates/new` and `/templates/:templateId/edit`. One component serves both, so when the
 * first save replaces `/new` with the edit URL the builder stays mounted: the template keeps
 * its ID, the `key` does not change, and the author's selection and focus are kept.
 */
export function BuilderPage() {
  const { templateId: rawId } = useParams();
  const [blank] = useState(blankTemplate);
  const { templates } = useRepositories();
  const snapshot = useCollection(templates);

  const isNew = rawId === undefined;
  const id = isNew ? blank.id : parseTemplateId(rawId);
  const stored = id && snapshot.ok ? snapshot.value.get(id) : undefined;
  const template = stored ?? (isNew ? blank : undefined);
  // Set here for every outcome: a parent's effect runs after its child's, so this one wins.
  usePageTitle(
    !snapshot.ok
      ? 'Storage problem'
      : !template
        ? 'Page not found'
        : isNew
          ? 'New template'
          : `Edit ${template.title}`,
  );

  if (!snapshot.ok) return <StorageErrorPanel error={snapshot.error} headingLevel={1} />;
  if (!template) return <NotFound />;
  return <Builder key={template.id} initial={template} isNew={isNew} />;
}
