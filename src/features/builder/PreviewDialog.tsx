import { useEffect, useRef, useState } from 'react';
import type { FormTemplate } from '../../domain/template';
import { ok } from '../../storage/result';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { LiveRegionProvider } from '../../ui/LiveRegion';
import { FillForm } from '../fill/FillForm';
import styles from './Builder.module.css';

export const PREVIEW_TRIGGER_ID = 'builder-preview';
const INTRO_ID = 'preview-intro';

interface PreviewDialogProps {
  /** The template as it is in the builder now, saved or not; `null` while Preview is closed. */
  template: FormTemplate | null;
  heading: string;
  onClose: () => void;
}

/**
 * Shows the form exactly as a respondent would fill it in, from the builder's unsaved template.
 * It is Fill's own `FillForm`, so validation, conditional visibility and required rules all run
 * as they will for real. Storage is only ever touched by Fill's route through its `onSubmit`;
 * here `onSubmit` stores nothing, so a preview never writes a response.
 *
 * The modal makes the rest of the page inert, the app's live region included, so the form's
 * announcements ("Nights shown") go to a live region of the dialog's own.
 */
export function PreviewDialog({ template, heading, onClose }: PreviewDialogProps) {
  return (
    <Dialog
      open={template !== null}
      title={`Preview: ${heading}`}
      size="wide"
      fallbackFocusId={PREVIEW_TRIGGER_ID}
      onClose={onClose}
    >
      {template && (
        <LiveRegionProvider>
          <PreviewBody template={template} onClose={onClose} />
        </LiveRegionProvider>
      )}
    </Dialog>
  );
}

function PreviewBody({ template, onClose }: { template: FormTemplate; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  // Bumped by Start again, so the form remounts empty.
  const [round, setRound] = useState(0);
  const intro = useRef<HTMLParagraphElement>(null);
  const notice = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitted) notice.current?.focus();
    else if (round > 0) intro.current?.focus();
  }, [submitted, round]);

  return (
    <div className={styles.preview}>
      <p id={INTRO_ID} ref={intro} tabIndex={-1} className={styles.previewIntro}>
        This is how respondents will see the form. Nothing you enter here is saved.
      </p>
      {submitted ? (
        <section className={styles.previewNotice} aria-labelledby="preview-submitted-title">
          <h3 id="preview-submitted-title" ref={notice} tabIndex={-1}>
            Preview submitted
          </h3>
          <p>The answers passed every check. Nothing was saved.</p>
          <div className={styles.dialogActions}>
            <Button
              onClick={() => {
                setSubmitted(false);
                setRound((count) => count + 1);
              }}
            >
              Start again
            </Button>
            <Button variant="primary" onClick={onClose}>
              Close preview
            </Button>
          </div>
        </section>
      ) : (
        // Close shares Submit's row rather than taking a row of its own below the form.
        <FillForm
          key={round}
          template={template}
          onSubmit={() => {
            setSubmitted(true);
            return ok(undefined);
          }}
          secondaryAction={
            <Button size="lg" onClick={onClose}>
              Close preview
            </Button>
          }
        />
      )}
    </div>
  );
}
