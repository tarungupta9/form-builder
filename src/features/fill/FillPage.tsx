import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { NotFound } from '../../app/NotFound';
import { usePageTitle } from '../../app/usePageTitle';
import { type ResponseId, newResponseId, parseResponseId, parseTemplateId } from '../../domain/ids';
import type { DraftResponse, FormResponse, SubmittedResponse } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { useCollection, useRepositories } from '../../storage/StorageContext';
import type { Result, StorageError } from '../../storage/result';
import { SubmittedResponseView } from '../responses/SubmittedResponseView';
import { StorageErrorPanel } from '../storage-error/StorageErrorPanel';
import { ResponseSession } from './ResponseSession';

/** What the page settled on when it opened, kept until the address asks for something else. */
type Opened =
  | {
      kind: 'fill';
      template: FormTemplate;
      responseId: ResponseId;
      draft: DraftResponse | null;
      /** The history entry a new response was opened from; `null` for a resumed draft. */
      visit: string | null;
    }
  | { kind: 'submitted'; response: SubmittedResponse };

/** What the address asks for: a new response on this visit, or one stored response. */
type Wanted = { kind: 'new'; visit: string } | { kind: 'stored'; responseId: ResponseId };

/**
 * `/templates/:templateId/respond` and `/templates/:templateId/responses/:responseId`: one route
 * component for both, so the first input can swap the first address for the second without
 * remounting the form under the respondent's cursor (D-23).
 *
 * - A new response opens a blank form. A new visit to `/respond` (Fill in another) is a new one.
 * - A draft resumes against the template as it is now, with a notice if it has changed.
 * - A submitted response opens read-only, from its export model (ADR 0011, ADR 0019).
 *
 * Whatever opened is then kept, even if storage changes in another tab meanwhile: following the
 * template live would move fields under the respondent's cursor (D-10), and a draft turning
 * into a submitted response under this session must not swap the confirmation for the record.
 */
export function FillPage() {
  const params = useParams();
  const location = useLocation();
  const { templates, responses } = useRepositories();
  const templateSnapshot = useCollection(templates);
  const responseSnapshot = useCollection(responses);

  const templateId = params.templateId === undefined ? null : parseTemplateId(params.templateId);
  const wanted: Wanted | null =
    params.responseId === undefined
      ? { kind: 'new', visit: location.key }
      : mapOrNull(parseResponseId(params.responseId), (responseId) => ({
          kind: 'stored',
          responseId,
        }));

  const [opened, setOpened] = useState<Opened | null>(null);
  const current = opened && wanted && isWhatIsWanted(opened, wanted) ? opened : null;
  if (!current && wanted && templateId) {
    const next = open(wanted, templateId, templateSnapshot, responseSnapshot);
    if (next) setOpened(next);
  }
  const shown = current && templateIdOf(current) === templateId ? current : null;

  usePageTitle(
    shown?.kind === 'fill'
      ? `${shown.draft ? 'Response in progress' : 'New response'}: ${shown.template.title}`
      : shown?.kind === 'submitted'
        ? `Response: ${shown.response.snapshot.title}`
        : !templateSnapshot.ok || !responseSnapshot.ok
          ? 'Storage problem'
          : 'Page not found',
  );

  if (shown?.kind === 'fill') {
    return (
      <ResponseSession
        key={shown.responseId}
        template={shown.template}
        responseId={shown.responseId}
        draft={shown.draft}
      />
    );
  }
  if (shown?.kind === 'submitted') return <SubmittedResponseView response={shown.response} />;
  if (!templateSnapshot.ok)
    return <StorageErrorPanel error={templateSnapshot.error} headingLevel={1} />;
  if (!responseSnapshot.ok)
    return <StorageErrorPanel error={responseSnapshot.error} headingLevel={1} />;
  return <NotFound />;
}

const mapOrNull = <T, U>(value: T | null, map: (value: T) => U): U | null =>
  value === null ? null : map(value);

const templateIdOf = (opened: Opened): FormTemplate['id'] =>
  opened.kind === 'fill' ? opened.template.id : opened.response.templateId;

function isWhatIsWanted(opened: Opened, wanted: Wanted): boolean {
  if (wanted.kind === 'new') return opened.kind === 'fill' && opened.visit === wanted.visit;
  // A new response whose first input moved it to its own address is still the same session.
  return (opened.kind === 'fill' ? opened.responseId : opened.response.id) === wanted.responseId;
}

/** Works out what to show, or `null` for not found (or unreadable storage). */
function open(
  wanted: Wanted,
  templateId: FormTemplate['id'],
  templates: Result<ReadonlyMap<FormTemplate['id'], FormTemplate>, StorageError>,
  responses: Result<ReadonlyMap<ResponseId, FormResponse>, StorageError>,
): Opened | null {
  const template = templates.ok ? templates.value.get(templateId) : undefined;
  if (wanted.kind === 'new') {
    return template
      ? { kind: 'fill', template, responseId: newResponseId(), draft: null, visit: wanted.visit }
      : null;
  }
  const response = responses.ok ? responses.value.get(wanted.responseId) : undefined;
  if (!response || response.templateId !== templateId) return null;
  if (response.status === 'submitted') return { kind: 'submitted', response };
  // A draft of a deleted template cannot normally exist (D-22); if one does, it is not found.
  return template
    ? { kind: 'fill', template, responseId: response.id, draft: response, visit: null }
    : null;
}
