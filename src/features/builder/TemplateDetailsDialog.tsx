import { type SyntheticEvent, useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Setting, controlClass } from '../../ui/Setting';
import styles from './Builder.module.css';
import { DESCRIPTION_MAX_LENGTH, type TemplateDetails, detailsIssues } from './configIssues';

/** Fixed IDs, so the builder can return focus to the trigger and tests can find the controls. */
export const DETAILS_IDS = {
  trigger: 'edit-details',
  title: 'details-title',
  description: 'details-description',
} as const;

interface TemplateDetailsDialogProps {
  open: boolean;
  details: TemplateDetails;
  /** Opened from a failed Save: show the problems straight away instead of after Done. */
  showIssues: boolean;
  onCancel: () => void;
  onApply: (details: TemplateDetails) => void;
}

/**
 * Edits the template's title and description. The author works on a draft, so Cancel or Escape
 * leaves the template as it was; Done applies both together, and only when they are valid.
 * Applying is not saving: the page's Save still writes the template.
 */
export function TemplateDetailsDialog({
  open,
  onCancel,
  ...formProps
}: TemplateDetailsDialogProps) {
  return (
    <Dialog
      open={open}
      title="Title and description"
      onClose={onCancel}
      fallbackFocusId={DETAILS_IDS.trigger}
    >
      <DetailsForm onCancel={onCancel} {...formProps} />
    </Dialog>
  );
}

function DetailsForm({
  details,
  showIssues,
  onCancel,
  onApply,
}: Omit<TemplateDetailsDialogProps, 'open'>) {
  const [draft, setDraft] = useState(details);
  const [submitted, setSubmitted] = useState(showIssues);
  const issues = detailsIssues(draft);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (issues.title) document.getElementById(DETAILS_IDS.title)?.focus();
    else if (issues.description) document.getElementById(DETAILS_IDS.description)?.focus();
    else onApply(draft);
  };

  return (
    <form noValidate className={styles.settings} onSubmit={handleSubmit}>
      <Setting id={DETAILS_IDS.title} label="Title" error={submitted ? issues.title : null}>
        {(control) => (
          <input
            {...control}
            aria-required
            className={controlClass}
            value={draft.title}
            onChange={(event) => {
              setDraft({ ...draft, title: event.target.value });
            }}
          />
        )}
      </Setting>
      <Setting
        id={DETAILS_IDS.description}
        label="Description"
        hint={`Optional. Shown on the card and above the form. ${draft.description.length} of ${DESCRIPTION_MAX_LENGTH} characters.`}
        // Over the limit is shown while typing: the count in the hint already says so.
        error={issues.description}
      >
        {(control) => (
          <textarea
            {...control}
            rows={4}
            className={controlClass}
            value={draft.description}
            onChange={(event) => {
              setDraft({ ...draft, description: event.target.value });
            }}
          />
        )}
      </Setting>
      <div className={styles.dialogActions}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">
          Done
        </Button>
      </div>
    </form>
  );
}
