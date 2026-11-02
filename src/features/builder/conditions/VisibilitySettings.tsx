import { useMemo } from 'react';
import type { DependencyGraph } from '../../../domain/rules/graph';
import { type ConditionGroup, type Field, withVisibility } from '../../../domain/template';
import segmented from '../../../fields/shared/Segmented.module.css';
import { EDITABLE_EFFECTS, type EditableEffect, GROUP_COPY } from './conditionGroups';
import { conditionIssues } from './conditionIssues';
import { allowedTargets, loopHint } from './conditionTargets';
import styles from './Conditions.module.css';
import { ConditionGroupEditor } from './ConditionGroupEditor';

interface VisibilitySettingsProps {
  field: Field;
  fields: readonly Field[];
  graph: DependencyGraph;
  /** Condition problems appear beside their controls only after a Save attempt. */
  showIssues: boolean;
  onChange: (field: Field) => void;
}

/**
 * D-3 for visibility, as one line of text: show conditions on a field that is already visible
 * have no effect. The warning machinery for every no-op group arrives in v0.7.
 */
export const ALREADY_VISIBLE_HINT =
  'This field is already visible, so these conditions only matter if it starts hidden.';

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
  showIssues,
  onChange,
}: VisibilitySettingsProps) {
  const choices = useMemo(() => allowedTargets(fields, graph, field.id), [fields, graph, field.id]);
  const issues = showIssues ? conditionIssues(field, fields, graph) : [];
  const hint = loopHint(choices);
  const headingId = `visibility-${field.id}`;
  const loopHintId = hint ? `visibility-loop-hint-${field.id}` : undefined;

  const setGroup = (effect: EditableEffect, group: ConditionGroup) => {
    onChange(withVisibility(field, { [effect]: group }));
  };

  return (
    <section className={styles.visibility} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Visibility
      </h3>
      <fieldset className={segmented.group}>
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
      {hint && (
        <p id={loopHintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {EDITABLE_EFFECTS.map((effect) => {
        const group = field.logic[effect];
        const isNoOp =
          effect === 'show' && field.logic.defaultVisible && group.conditions.length > 0;
        return (
          <ConditionGroupEditor
            key={effect}
            groupKey={effect}
            copy={GROUP_COPY[effect]}
            group={group}
            ownerId={field.id}
            fields={fields}
            choices={choices}
            loopHintId={loopHintId}
            note={isNoOp ? ALREADY_VISIBLE_HINT : null}
            issues={issues}
            onChange={(next) => {
              setGroup(effect, next);
            }}
          />
        );
      })}
    </section>
  );
}
