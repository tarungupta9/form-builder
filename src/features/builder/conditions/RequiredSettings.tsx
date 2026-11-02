import type { DependencyGraph } from '../../../domain/rules/graph';
import type { Field, InputField } from '../../../domain/template';
import { Switch } from '../../../ui/Switch';
import { GROUP_COPY, REQUIRED_EFFECTS } from './conditionGroups';
import { conditionIssues } from './conditionIssues';
import { type ConditionWarning, warningsFor } from './conditionWarnings';
import styles from './Conditions.module.css';
import { ConditionGroupEditor } from './ConditionGroupEditor';
import { requiredSummary } from './requiredSummary';
import { useConditionTargets } from './useConditionTargets';

interface RequiredSettingsProps {
  /** Only fields that take an answer have a required axis; the type rules out the rest. */
  field: InputField;
  fields: readonly Field[];
  graph: DependencyGraph;
  /** This field's warnings; never a reason to block Save. */
  warnings: readonly ConditionWarning[];
  /** Condition problems appear beside their controls only after a Save attempt. */
  showIssues: boolean;
  onChange: (field: Field) => void;
}

/**
 * Whether a respondent must answer the field: the Required switch is the default, and the
 * _Mark as required_ and _Mark as not required_ groups change it. Require beats not-require
 * when both match (D-2), and a hidden field is never required, whatever these say. A summary
 * sentence reads the three back as one rule.
 */
export function RequiredSettings({
  field,
  fields,
  graph,
  warnings,
  showIssues,
  onChange,
}: RequiredSettingsProps) {
  const { choices, hint } = useConditionTargets(field, fields, graph);
  const issues = showIssues ? conditionIssues(field, fields, graph) : [];
  const headingId = `required-${field.id}`;
  const summaryId = `required-summary-${field.id}`;
  const hasConditions = REQUIRED_EFFECTS.some(
    (effect) => field.logic[effect].conditions.length > 0,
  );
  // The Visibility section always shows this hint; here only once there is a condition to read it.
  const loopHintId = hint && hasConditions ? `required-loop-hint-${field.id}` : undefined;

  return (
    <section className={styles.section} aria-labelledby={headingId} aria-describedby={summaryId}>
      <h3 id={headingId} className={styles.heading}>
        Required
      </h3>
      <Switch
        label="Required"
        description="Respondents must answer before they can submit."
        checked={field.logic.defaultRequired}
        onChange={(defaultRequired) => {
          onChange({ ...field, logic: { ...field.logic, defaultRequired } });
        }}
      />
      <p id={summaryId} className={styles.summary}>
        {requiredSummary(field.logic)}
      </p>
      {loopHintId && (
        <p id={loopHintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {REQUIRED_EFFECTS.map((effect) => (
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
          onChange={(group) => {
            onChange({ ...field, logic: { ...field.logic, [effect]: group } });
          }}
        />
      ))}
    </section>
  );
}
