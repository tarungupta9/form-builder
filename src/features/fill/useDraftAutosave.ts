import { useCallback, useEffect, useRef, useState } from 'react';
import { type IsoDateTime, type ResponseId, toIsoDateTime } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import type { FormTemplate } from '../../domain/template';
import { useRepositories } from '../../storage/StorageContext';
import type { StorageError } from '../../storage/result';
import { toDraft } from './draft';

/** How long typing must pause before the draft is written (HLD §8). */
export const AUTOSAVE_DELAY_MS = 400;

interface DraftAutosaveOptions {
  template: FormTemplate;
  responseId: ResponseId;
  startedAt: IsoDateTime;
  /** A resumed draft is already stored, so its first change is debounced like any other. */
  alreadyStored: boolean;
  /** Called once, when the first input has created the draft, so the URL can follow it. */
  onCreated: () => void;
}

export interface DraftAutosave {
  /** Hand over the latest answers after a change the respondent made. */
  save: (values: ResponseValues) => void;
  /** The response was submitted under the same ID: no draft may be written over it. */
  stop: () => void;
  /** The last write failed; cleared by the next one that succeeds. */
  error: StorageError | null;
}

/**
 * Saves a response in progress as a draft (D-23). The first input writes it at once, so the
 * draft exists and the URL can point to it; later changes are debounced, and anything still
 * waiting is written when the page is hidden or closed (`visibilitychange`, `pagehide`) or the
 * form is left inside the app, so no typing is lost to a refresh or a closed tab.
 *
 * This lives in Fill's session, not in the form, so Preview, which shares the form, never
 * writes a draft (ADR 0016). Two writes are refused rather than made: one for a template
 * deleted in another tab, which would leave a draft nothing lists, and one over a response
 * already submitted under this ID, in another tab, which a draft must never replace.
 */
export function useDraftAutosave({
  template,
  responseId,
  startedAt,
  alreadyStored,
  onCreated,
}: DraftAutosaveOptions): DraftAutosave {
  const { templates, responses } = useRepositories();
  const [error, setError] = useState<StorageError | null>(null);
  // Mutable bookkeeping that must not re-render: the timer, what is waiting, and the phase.
  const state = useRef({
    stored: alreadyStored,
    stopped: false,
    pending: null as ResponseValues | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  const write = useCallback(
    (values: ResponseValues): boolean => {
      const currentTemplates = templates.snapshot();
      if (currentTemplates.ok && !currentTemplates.value.has(template.id)) return false;
      const currentResponses = responses.snapshot();
      if (currentResponses.ok && currentResponses.value.get(responseId)?.status === 'submitted') {
        return false;
      }
      const draft = toDraft(template, values, {
        id: responseId,
        startedAt,
        savedAt: toIsoDateTime(new Date()),
      });
      const written = responses.put(draft);
      setError(written.ok ? null : written.error);
      return written.ok;
    },
    [templates, responses, template, responseId, startedAt],
  );

  const flush = useCallback(() => {
    const current = state.current;
    clearTimeout(current.timer);
    current.timer = undefined;
    if (current.stopped || current.pending === null) return;
    const values = current.pending;
    current.pending = null;
    write(values);
  }, [write]);

  const save = useCallback(
    (values: ResponseValues) => {
      const current = state.current;
      if (current.stopped) return;
      if (!current.stored) {
        // A failed first write leaves `stored` false, so the next change tries again.
        if (write(values)) {
          current.stored = true;
          onCreated();
        }
        return;
      }
      current.pending = values;
      clearTimeout(current.timer);
      current.timer = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    [write, flush, onCreated],
  );

  const stop = useCallback(() => {
    const current = state.current;
    current.stopped = true;
    current.pending = null;
    clearTimeout(current.timer);
  }, []);

  useEffect(() => {
    const flushIfHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flushIfHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flushIfHidden);
      // Leaving the form inside the app (a link, Back) unmounts it: keep what was typed.
      flush();
    };
  }, [flush]);

  return { save, stop, error };
}
