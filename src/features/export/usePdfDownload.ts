import { useCallback, useRef, useState } from 'react';
import type { ResponseId } from '../../domain/ids';
import type { SubmittedResponse } from '../../domain/response';
import { toExportModel } from './exportModel';
import { printDocument } from './printDocument';

/** Shown when the browser will not open its print dialog. A cancelled dialog is not a failure. */
export const PRINT_FAILURE = {
  title: 'Couldn’t open the print dialog',
  body: 'Your browser did not let this page print. Check that printing is allowed for this site, then try again. The response itself is saved.',
};

/**
 * Downloads responses as PDFs, one at a time. While one is being prepared, `busyId` names it
 * and further presses are ignored, so a double click never opens two dialogs. Nothing claims
 * success afterwards: a saved PDF and a cancelled dialog look the same to the page.
 */
export function usePdfDownload() {
  const [busyId, setBusyId] = useState<ResponseId | null>(null);
  const [failed, setFailed] = useState(false);
  // A ref, not the state, guards repeats: two presses in one frame both see the old state.
  const busy = useRef(false);

  const download = useCallback(async (response: SubmittedResponse) => {
    if (busy.current) return;
    busy.current = true;
    setBusyId(response.id);
    setFailed(false);
    try {
      await printDocument(toExportModel(response));
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setBusyId(null);
    }
  }, []);

  return { busyId, failed, download };
}
