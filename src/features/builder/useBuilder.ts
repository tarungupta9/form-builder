import { useCallback, useMemo, useReducer } from 'react';
import { toIsoDateTime } from '../../domain/ids';
import { buildDependencyGraph } from '../../domain/rules/graph';
import type { FormTemplate } from '../../domain/template';
import { useRepositories } from '../../storage/StorageContext';
import type { Repositories } from '../../storage/repositories';
import type { StorageError } from '../../storage/result';
import { builderReducer, hasUnsavedChanges, initialBuilderState } from './builderReducer';
import { configIssues } from './configIssues';
import { conditionWarnings } from './conditions/conditionWarnings';

export type SaveOutcome =
  | { status: 'saved'; template: FormTemplate }
  /** Config issues block Save; nothing was written. */
  | { status: 'invalid' }
  /** Storage refused the write; the edits are still in memory. */
  | { status: 'failed'; error: StorageError }
  /** Another tab saved this template after this one opened or last saved it; nothing was written. */
  | { status: 'conflict'; theirs: FormTemplate }
  /** Another tab deleted this template; nothing was written. */
  | { status: 'deleted' };

interface SaveOptions {
  /** The author has seen the conflict and chosen to replace the stored copy, or to re-create it. */
  overwrite?: boolean;
}

/**
 * The builder's state, the problems that block Save, and Save itself. Save writes the template
 * only through this hook, and only when there is nothing to fix.
 *
 * Warnings (D-2, D-3) are a separate channel on purpose: Save reads `issues` only, so a warning
 * can never block it.
 *
 * Save never overwrites another tab's work unseen (HLD §4.5). The collection drops its cache on
 * the other tab's `storage` event, so the stored copy read here is current; if its `updatedAt`
 * is not the one this tab last saved or opened, Save reports a conflict and the author chooses.
 *
 * The dependency graph is rebuilt only when the fields change. That still happens on every
 * label keystroke, which is fine: building it is linear in fields plus conditions.
 */
export function useBuilder(initial: FormTemplate, { isNew }: { isNew: boolean }) {
  const { templates } = useRepositories();
  const [state, dispatch] = useReducer(builderReducer, initial, initialBuilderState);
  const graph = useMemo(() => buildDependencyGraph(state.template.fields), [state.template.fields]);
  const issues = useMemo(() => configIssues(state.template, graph), [state.template, graph]);
  const warnings = useMemo(
    () => new Map(state.template.fields.map((field) => [field.id, conditionWarnings(field)])),
    [state.template.fields],
  );

  const isDirty = useMemo(() => hasUnsavedChanges(state), [state]);

  const save = useCallback(
    ({ overwrite = false }: SaveOptions = {}): SaveOutcome => {
      if (issues.count > 0) return { status: 'invalid' };
      if (!overwrite) {
        const changed = changedElsewhere(templates.snapshot(), state.saved, isNew);
        if (changed) return changed;
      }
      const saved: FormTemplate = { ...state.template, updatedAt: toIsoDateTime(new Date()) };
      const written = templates.put(saved);
      if (!written.ok) return { status: 'failed', error: written.error };
      dispatch({ type: 'template/saved', template: saved });
      return { status: 'saved', template: saved };
    },
    [issues.count, isNew, state.saved, state.template, templates],
  );

  return { state, dispatch, graph, issues, warnings, isDirty, save };
}

/**
 * Whether another tab has saved or deleted the template since this tab last saw it. An unreadable
 * collection is not a conflict: the write is then refused, and Save reports that instead.
 */
function changedElsewhere(
  snapshot: ReturnType<Repositories['templates']['snapshot']>,
  lastSeen: FormTemplate,
  isNew: boolean,
): SaveOutcome | null {
  if (!snapshot.ok) return null;
  const stored = snapshot.value.get(lastSeen.id);
  if (!stored) return isNew ? null : { status: 'deleted' };
  return stored.updatedAt === lastSeen.updatedAt ? null : { status: 'conflict', theirs: stored };
}
