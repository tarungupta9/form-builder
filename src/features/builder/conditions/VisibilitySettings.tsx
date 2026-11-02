import type { DependencyGraph } from '../../../domain/rules/graph';
import { type ConditionGroup, type Field, withVisibility } from '../../../domain/template';
import segmented from '../../../fields/shared/Segmented.module.css';
import { GROUP_COPY, VISIBILITY_EFFECTS } from './conditionGroups';
import { conditionIssues } from './conditionIssues';
import { type ConditionWarning, warningsFor } from './conditionWarnings';
import styles from './Conditions.module.css';
import { ConditionGroupEditor } from './ConditionGroupEditor';
import { useConditionTargets } from './useConditionTargets';

interface VisibilitySettingsProps {
  field: Field;
  fields: readonly Field[];
  graph: DependencyGraph;
  /** This field's warnings; never a reason to block Save. */
  warnings: readonly ConditionWarning[];
  /** Condition problems appear beside their controls only after a Save attempt. */
  showIssues: boolean;
  onChange: (field: Field) => void;
}

const STARTS: { visible: boolean; label: string }[] = [
  { visible: true, label: 'Visible' },
  { visible: false, label: 'Hidden' },
];

/**
 * Whether a field shows when the form opens, and the Show and Hide groups that change it.
 * Every field has them, section headers included. Hide beats Show when both match (D-2).
 */
export function VisibilitySettings({
  field,
  fields,
  graph,
  warnings,
  showIssues,
  onChange,
}: VisibilitySettingsProps) {
  const { choices, hint } = useConditionTargets(field, fields, graph);
  const issues = showIssues ? conditionIssues(field, fields, graph) : [];
  const headingId = `visibility-${field.id}`;
  const loopHintId = hint ? `visibility-loop-hint-${field.id}` : undefined;
  const [fieldNote] = warningsFor(warnings, null);
  const fieldNoteId = `visibility-note-${field.id}`;

  const setGroup = (effect: (typeof VISIBILITY_EFFECTS)[number], group: ConditionGroup) => {
    onChange(withVisibility(field, { [effect]: group }));
  };

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Visibility
      </h3>
      <fieldset className={segmented.group} aria-describedby={fieldNote ? fieldNoteId : undefined}>
        <legend className={segmented.legend}>When the form opens</legend>
        <div className={segmented.options}>
          {STARTS.map(({ visible, label }) => (
            <label key={label} className={segmented.option}>
              <input
                type="radio"
                name={`default-visible-${field.id}`}
                checked={field.logic.defaultVisible === visible}
                onChange={() => {
                  onChange(withVisibility(field, { defaultVisible: visible }));
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {fieldNote && (
        <p id={fieldNoteId} className={styles.note}>
          <span className="visually-hidden">Note: </span>
          {fieldNote}
        </p>
      )}
      {hint && (
        <p id={loopHintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {VISIBILITY_EFFECTS.map((effect) => (
        <ConditionGroupEditor
          key={effect}
          groupKey={effect}
          copy={GROUP_COPY[effect]}
          group={field.logic[effect]}
          ownerId={field.id}
          fields={fields}
          choices={choices}
          loopHintId={loopHintId}
          notes={warningsFor(warnings, effect)}
          issues={issues}
          onChange={(next) => {
            setGroup(effect, next);
          }}
        />
      ))}
    </section>
  );
}
