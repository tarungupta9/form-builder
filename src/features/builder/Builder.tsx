import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { newFieldId } from '../../domain/ids';
import type { Field, FieldType, FormTemplate } from '../../domain/template';
import { definitionFor } from '../../fields/registry';
import { KEEP_FOCUS } from '../../app/navigation';
import type { StorageError } from '../../storage/result';
import { describeStorageError } from '../../storage/storageMessages';
import { Button, ButtonLink, IconButton } from '../../ui/Button';
import { FailureAlert } from '../../ui/ErrorSummary';
import { useAnnounce } from '../../ui/LiveRegion';
import { PageHeader } from '../../ui/PageHeader';
import { formatDateTime } from '../../ui/format';
import styles from './Builder.module.css';
import { insertionIndex } from './builderReducer';
import { Canvas, canvasItemId, fieldName } from './Canvas';
import { CONFIG_IDS } from './configIds';
import { ConfigPanel } from './ConfigPanel';
import { FieldPalette } from './FieldPalette';
import { IssueSummary } from './IssueSummary';
import { DETAILS_IDS, TemplateDetailsDialog } from './TemplateDetailsDialog';
import { useBuilder } from './useBuilder';
import { useFocusRequest } from '../../ui/useFocusRequest';

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
  const { state, dispatch, graph, issues, save } = useBuilder(initial);
  const { template, selectedFieldId } = state;
  const navigate = useNavigate();
  const announce = useAnnounce();
  const focusLater = useFocusRequest();
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const showSummary = saveAttempted && issues.count > 0;

  // The summary appears in the same render as the failed Save, so focus it once it is there.
  const [summaryRequest, setSummaryRequest] = useState(0);
  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus();
  }, [summaryRequest]);

  const selectedField = template.fields.find((field) => field.id === selectedFieldId) ?? null;
  const heading = template.title.trim() || 'Untitled template';

  const addField = (type: FieldType) => {
    const definition = definitionFor(type);
    const field = definition.create(newFieldId());
    const position = insertionIndex(template.fields, selectedFieldId) + 1;
    dispatch({ type: 'field/added', field });
    focusLater(canvasItemId(field.id));
    announce(
      `${definition.paletteLabel} added at position ${position} of ${template.fields.length + 1}`,
    );
  };

  const removeField = (field: Field) => {
    const index = template.fields.findIndex((candidate) => candidate.id === field.id);
    const neighbour = template.fields[index + 1] ?? template.fields[index - 1];
    dispatch({ type: 'field/removed', fieldId: field.id });
    focusLater(neighbour ? canvasItemId(neighbour.id) : 'canvas-title');
    announce(`Removed ${fieldName(field)}`);
  };

  const handleSave = () => {
    setStorageError(null);
    const outcome = save();
    switch (outcome.status) {
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
            <Button variant="primary" onClick={handleSave}>
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
        <FieldPalette onAdd={addField} />
        <Canvas
          fields={template.fields}
          selectedFieldId={selectedFieldId}
          fieldsWithIssues={new Set(issues.fields.keys())}
          onSelect={(fieldId) => {
            dispatch({ type: 'field/selected', fieldId });
          }}
          onRemove={removeField}
        />
        <ConfigPanel
          template={template}
          graph={graph}
          selectedField={selectedField}
          fieldIssues={(selectedField && issues.fields.get(selectedField.id)) ?? []}
          showIssues={saveAttempted}
          onFieldChange={(field) => {
            dispatch({ type: 'field/updated', field });
          }}
        />
      </div>

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
