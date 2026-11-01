import { useCallback, useMemo, useReducer } from 'react';
import { toIsoDateTime } from '../../domain/ids';
import type { FormTemplate } from '../../domain/template';
import { useRepositories } from '../../storage/StorageContext';
import type { StorageError } from '../../storage/result';
import { builderReducer, initialBuilderState } from './builderReducer';
import { configIssues } from './configIssues';

export type SaveOutcome =
  | { status: 'saved'; template: FormTemplate }
  /** Config issues block Save; nothing was written. */
  | { status: 'invalid' }
  /** Storage refused the write; the edits are still in memory. */
  | { status: 'failed'; error: StorageError };

/**
 * The builder's state, the problems that block Save, and Save itself. Save writes the template
 * only through this hook, and only when there is nothing to fix.
 */
export function useBuilder(initial: FormTemplate) {
  const { templates } = useRepositories();
  const [state, dispatch] = useReducer(builderReducer, initial, initialBuilderState);
  const issues = useMemo(() => configIssues(state.template), [state.template]);

  const save = useCallback((): SaveOutcome => {
    if (issues.count > 0) return { status: 'invalid' };
    const saved: FormTemplate = { ...state.template, updatedAt: toIsoDateTime(new Date()) };
    const written = templates.put(saved);
    if (!written.ok) return { status: 'failed', error: written.error };
    dispatch({ type: 'template/saved', template: saved });
    return { status: 'saved', template: saved };
  }, [issues.count, state.template, templates]);

  return { state, dispatch, issues, save };
}
