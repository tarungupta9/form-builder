import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { newFieldId } from '../../domain/ids';
import { dependantsOf } from '../../domain/rules/references';
import type { FieldId } from '../../domain/ids';
import type { Field, FieldType, FormTemplate } from '../../domain/template';
import { definitionFor } from '../../fields/registry';
import { KEEP_FOCUS } from '../../app/navigation';
import type { StorageError } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';
import { Button, ButtonLink, IconButton } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { FailureAlert } from '../../ui/ErrorSummary';
import { useAnnounce } from '../../ui/LiveRegion';
import { removedConditions } from '../../ui/RemovalDialog';
import { PageHeader } from '../../ui/PageHeader';
import { formatDateTime } from '../../ui/format';
import styles from './Builder.module.css';
import { insertionIndex } from './builderReducer';
import { BuilderDragAndDrop } from './BuilderDragAndDrop';
import { Canvas, type MoveDirection, canvasItemId, fieldName, moveButtonId } from './Canvas';
import { CONFIG_IDS } from './configIds';
import { ConfigPanel } from './ConfigPanel';
import type { ConditionWarning } from './conditions/conditionWarnings';
import { FieldPalette } from './FieldPalette';
import { IssueSummary } from './IssueSummary';
import { PREVIEW_TRIGGER_ID, PreviewDialog } from './PreviewDialog';
import { type PendingRemoval, RemoveFieldDialog } from './RemoveFieldDialog';
import { type SaveConflict, SaveConflictDialog } from './SaveConflictDialog';
import { DETAILS_IDS, TemplateDetailsDialog } from './TemplateDetailsDialog';
import { useBuilder } from './useBuilder';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import { useFocusRequest } from '../../ui/useFocusRequest';

const NO_WARNINGS: readonly ConditionWarning[] = [];
const SAVE_ID = 'builder-save';

interface BuilderProps {
  initial: FormTemplate;
  /** Not yet saved: the first save gives the template its own URL. */
  isNew: boolean;
}

/**
 * Builder mode: palette, canvas and config panel around one template being edited. The editing
 * rules live in `builderReducer` and `useBuilder`; this component wires them to the screen and
 * owns the screen-only concerns: focus, announcements and navigation after a save.
 */
export function Builder({ initial, isNew }: BuilderProps) {
  const { state, dispatch, graph, issues, warnings, isDirty, save } = useBuilder(initial, {
    isNew,
  });
  const { template, selectedFieldId } = state;
  const navigate = useNavigate();
  const announce = useAnnounce();
  const focusLater = useFocusRequest();
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [removal, setRemoval] = useState<PendingRemoval | null>(null);
  const [previewed, setPreviewed] = useState<FormTemplate | null>(null);
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const leaving = useUnsavedChangesGuard(isDirty, template.id);
  const summaryRef = useRef<HTMLDivElement>(null);
  const showSummary = saveAttempted && issues.count > 0;

  // The summary appears in the same render as the failed Save, so focus it once it is there.
  const [summaryRequest, setSummaryRequest] = useState(0);
  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus();
  }, [summaryRequest]);

  const selectedField = template.fields.find((field) => field.id === selectedFieldId) ?? null;
  const heading = template.title.trim() || 'Untitled template';

  /** A palette click adds after the selection and says so; a palette drop gives `at`, and dnd-kit says it. */
  const addField = (type: FieldType, at?: number) => {
    const definition = definitionFor(type);
    const field = definition.create(newFieldId());
    dispatch({ type: 'field/added', field, at });
    focusLater(canvasItemId(field.id));
    if (at !== undefined) return;
    const position = insertionIndex(template.fields, selectedFieldId) + 1;
    announce(
      `${definition.paletteLabel} added at position ${position} of ${template.fields.length + 1}`,
    );
  };

  /**
   * Move up and Move down. React moves the item's DOM node, which blurs the pressed button, so
   * focus is put back on it; at either end that button is disabled, so the other one takes it.
   */
  const moveField = (fieldId: FieldId, direction: MoveDirection) => {
    const from = template.fields.findIndex((field) => field.id === fieldId);
    const field = template.fields[from];
    const to = direction === 'up' ? from - 1 : from + 1;
    if (!field || to < 0 || to >= template.fields.length) return;
    dispatch({ type: 'field/moved', fieldId: field.id, toIndex: to });
    const atEnd = to === 0 || to === template.fields.length - 1;
    const keep = atEnd ? (direction === 'up' ? 'down' : 'up') : direction;
    focusLater(moveButtonId(field.id, keep));
    announce(`${fieldName(field)} moved to position ${to + 1} of ${template.fields.length}`);
  };

  /**
   * A field nothing reads goes at once, as before. A field others read asks first (D-12); the
   * dialog then owns focus on both Cancel and confirm, so this sets no focus of its own.
   */
  const removeField = (field: Field) => {
    const index = template.fields.findIndex((candidate) => candidate.id === field.id);
    const neighbour = template.fields[index + 1] ?? template.fields[index - 1];
    const focusAfter = neighbour ? canvasItemId(neighbour.id) : 'canvas-title';
    const dependants = dependantsOf(template.fields, field.id);
    if (dependants.length > 0) {
      setRemoval({ field, dependants, focusAfter, open: true });
      return;
    }
    dispatch({ type: 'field/removed', fieldId: field.id });
    focusLater(focusAfter);
    announce(`Removed ${fieldName(field)}`);
  };

  const closeRemoval = () => {
    setRemoval((pending) => pending && { ...pending, open: false });
  };

  const confirmRemoval = ({ field, dependants }: PendingRemoval) => {
    dispatch({ type: 'field/removed', fieldId: field.id });
    closeRemoval();
    announce(`Removed ${fieldName(field)} and ${removedConditions(dependants)}.`);
  };

  const handleSave = (overwrite = false) => {
    setStorageError(null);
    setConflict(null);
    const outcome = save({ overwrite });
    switch (outcome.status) {
      case 'conflict':
        setConflict({ kind: 'changed', theirs: outcome.theirs });
        return;
      case 'deleted':
        setConflict({ kind: 'deleted' });
        return;
      case 'invalid':
        setSaveAttempted(true);
        setSummaryRequest((count) => count + 1);
        return;
      case 'failed':
        setStorageError(outcome.error);
        return;
      case 'saved':
        setSaveAttempted(false);
        announce('Template saved');
        if (isNew) {
          void navigate(`/templates/${outcome.template.id}/edit`, {
            replace: true,
            state: KEEP_FOCUS,
          });
        }
        return;
    }
  };

  return (
    <>
      <PageHeader
        title={heading}
        titleAction={
          <IconButton
            id={DETAILS_IDS.trigger}
            icon="edit"
            label="Edit title and description"
            onClick={() => {
              setDetailsOpen(true);
            }}
          />
        }
        actions={
          <>
            <ButtonLink to="/" variant="quiet" icon="back">
              All templates
            </ButtonLink>
            {/* Allowed while Save is blocked: authors preview mid-edit (D8-4). */}
            <Button
              id={PREVIEW_TRIGGER_ID}
              icon="eye"
              onClick={() => {
                setPreviewed(template);
              }}
            >
              Preview
            </Button>
            <Button
              id={SAVE_ID}
              variant="primary"
              onClick={() => {
                handleSave();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        {template.description && (
          <p className={styles.templateDescription}>{template.description}</p>
        )}
        <p className={styles.saveState}>
          {isNew ? (
            'Not saved yet'
          ) : (
            <>
              Last saved{' '}
              <time dateTime={template.updatedAt}>{formatDateTime(template.updatedAt)}</time>
            </>
          )}
        </p>
      </PageHeader>

      {storageError && <FailureAlert {...describeStorageError(storageError)} />}
      {showSummary && (
        <IssueSummary
          ref={summaryRef}
          issues={issues}
          fields={template.fields}
          onShowDetails={() => {
            setDetailsOpen(true);
          }}
          onShowField={(fieldId, issue) => {
            dispatch({ type: 'field/selected', fieldId });
            focusLater(issue.controlId ?? CONFIG_IDS.panelTitle);
          }}
        />
      )}

      <div className={styles.layout}>
        <BuilderDragAndDrop
          fields={template.fields}
          onMove={(fieldId, toIndex) => {
            dispatch({ type: 'field/moved', fieldId, toIndex });
          }}
          onAdd={addField}
        >
          <FieldPalette
            onAdd={(type) => {
              addField(type);
            }}
          />
          <Canvas
            fields={template.fields}
            selectedFieldId={selectedFieldId}
            fieldsWithIssues={new Set(issues.fields.keys())}
            onSelect={(fieldId) => {
              dispatch({ type: 'field/selected', fieldId });
            }}
            onMove={moveField}
            onRemove={removeField}
          />
        </BuilderDragAndDrop>
        <ConfigPanel
          template={template}
          graph={graph}
          selectedField={selectedField}
          fieldIssues={(selectedField && issues.fields.get(selectedField.id)) ?? []}
          fieldWarnings={(selectedField && warnings.get(selectedField.id)) ?? NO_WARNINGS}
          showIssues={saveAttempted}
          onFieldChange={(field) => {
            dispatch({ type: 'field/updated', field });
          }}
        />
      </div>

      <RemoveFieldDialog removal={removal} onCancel={closeRemoval} onConfirm={confirmRemoval} />

      <PreviewDialog
        template={previewed}
        heading={heading}
        onClose={() => {
          setPreviewed(null);
        }}
      />

      <SaveConflictDialog
        conflict={conflict}
        fallbackFocusId={SAVE_ID}
        onCancel={() => {
          setConflict(null);
        }}
        onOverwrite={() => {
          handleSave(true);
        }}
        onUseTheirs={(theirs) => {
          dispatch({ type: 'template/saved', template: theirs });
          setConflict(null);
          setSaveAttempted(false);
          announce('Loaded the version saved in the other tab');
        }}
      />

      <ConfirmDialog
        open={leaving.state === 'blocked'}
        title="Leave without saving?"
        cancelLabel="Stay"
        confirmLabel="Leave without saving"
        fallbackFocusId={SAVE_ID}
        onCancel={() => {
          leaving.reset?.();
        }}
        onConfirm={() => {
          leaving.proceed?.();
        }}
      >
        <p>Your changes to {heading} since the last save will be lost.</p>
      </ConfirmDialog>

      <TemplateDetailsDialog
        open={detailsOpen}
        details={template}
        showIssues={saveAttempted}
        onCancel={() => {
          setDetailsOpen(false);
        }}
        onApply={(details) => {
          dispatch({ type: 'details/changed', ...details });
          setDetailsOpen(false);
          announce('Title and description updated');
        }}
      />
    </>
  );
}
