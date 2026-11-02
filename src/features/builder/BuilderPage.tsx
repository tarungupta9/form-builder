import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
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
 *
 * The template is kept as it was opened, as Fill does. If another tab deletes it meanwhile, the
 * builder stays open with the author's edits, and Save offers to save it again (HLD §4.5).
 *
 * Staying mounted has a cost: going from an edit URL straight to `/new` (an edited address bar)
 * reuses this component too. So the blank template belongs to one visit to `/new`, told apart by
 * the location's key, and a new visit gets a new one. Otherwise `/new` would reopen the template
 * that blank had become on its first save, and saving there would overwrite it.
 */
export function BuilderPage() {
  const { templateId: rawId } = useParams();
  const { key: visit } = useLocation();
  const isNew = rawId === undefined;
  const [blankVisit, setBlankVisit] = useState(() => ({ visit, blank: blankTemplate() }));
  if (isNew && blankVisit.visit !== visit) setBlankVisit({ visit, blank: blankTemplate() });
  const { blank } = blankVisit;
  const { templates } = useRepositories();
  const snapshot = useCollection(templates);

  const id = isNew ? blank.id : parseTemplateId(rawId);
  const stored = id && snapshot.ok ? snapshot.value.get(id) : undefined;
  const [opened, setOpened] = useState<FormTemplate | undefined>(stored);
  // A different template in the URL (or one that loads late) is a new template to open.
  if (stored && opened?.id !== stored.id) setOpened(stored);
  const kept = opened?.id === id ? opened : undefined;
  const template = kept ?? (isNew && snapshot.ok ? blank : undefined);
  // Set here for every outcome: a parent's effect runs after its child's, so this one wins.
  usePageTitle(
    template
      ? isNew
        ? 'New template'
        : `Edit ${(stored ?? template).title}`
      : !snapshot.ok
        ? 'Storage problem'
        : 'Page not found',
  );

  if (template) return <Builder key={template.id} initial={template} isNew={isNew} />;
  if (!snapshot.ok) return <StorageErrorPanel error={snapshot.error} headingLevel={1} />;
  return <NotFound />;
}
