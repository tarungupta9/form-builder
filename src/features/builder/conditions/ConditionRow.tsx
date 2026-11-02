import { OPERATORS, withOperator } from '../../../domain/rules/predicates';
import type { Condition, Field } from '../../../domain/template';
import { IconButton } from '../../../ui/Button';
import { selectClass } from '../../../ui/Setting';
import { conditionControlId } from './conditionGroups';
import type { ConditionIssue } from './conditionIssues';
import { type TargetChoice, positionName, retarget } from './conditionTargets';
import styles from './Conditions.module.css';
import { type ControlWiring, PredicateValueInput } from './PredicateValueInput';

interface ConditionRowProps {
  condition: Condition;
  /** "Show condition 2": names every control in the row. */
  name: string;
  fields: readonly Field[];
  choices: readonly TargetChoice[];
  /** The visible reason some targets are disabled, read with the target select. */
  loopHintId: string | undefined;
  /** Shown only after a Save attempt, like every other config issue. */
  issue: ConditionIssue | undefined;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}

/** One condition: the field it reads, how it compares, the value, and Remove. */
export function ConditionRow({
  condition,
  name,
  fields,
  choices,
  loopHintId,
  issue,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const { predicate } = condition;
  const errorId = `${conditionControlId(condition.id, 'target')}-error`;
  const current = choices.find((choice) => choice.field.id === condition.targetFieldId);

  const wiring: ControlWiring = (control) => {
    const id = conditionControlId(condition.id, control);
    const invalid = issue?.controlId === id;
    const describedBy = [
      control === 'target' ? loopHintId : undefined,
      invalid ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ');
    return { id, 'aria-invalid': invalid, 'aria-describedby': describedBy || undefined };
  };

  return (
    <li className={styles.row}>
      <div className={styles.rowTop}>
        <select
          {...wiring('target')}
          aria-label={`${name}: field`}
          className={selectClass}
          value={condition.targetFieldId}
          onChange={(event) => {
            const choice = choices.find((candidate) => candidate.field.id === event.target.value);
            if (choice) onChange(retarget(condition, choice));
          }}
        >
          {!current && (
            <option value={condition.targetFieldId} disabled>
              {unavailableTargetName(condition, fields)}
            </option>
          )}
          {choices.map((choice) => (
            <option
              key={choice.field.id}
              value={choice.field.id}
              disabled={choice.disabledReason !== null}
            >
              {choice.disabledReason ? `${choice.name} (${choice.disabledReason})` : choice.name}
            </option>
          ))}
        </select>
        <IconButton icon="close" label={`Remove ${name.toLowerCase()}`} onClick={onRemove} />
      </div>
      <div className={styles.rowBottom}>
        <select
          {...wiring('operator')}
          aria-label={`${name}: operator`}
          className={selectClass}
          value={predicate.op}
          onChange={(event) => {
            onChange({ ...condition, predicate: withOperator(predicate, event.target.value) });
          }}
        >
          {OPERATORS[predicate.kind].map((operator) => (
            <option key={operator.op} value={operator.op}>
              {operator.label}
            </option>
          ))}
        </select>
        <PredicateValueInput
          predicate={predicate}
          target={current?.target ?? null}
          name={name}
          wiring={wiring}
          onChange={(next) => {
            onChange({ ...condition, predicate: next });
          }}
        />
      </div>
      {issue && (
        <p id={errorId} className={styles.error}>
          {issue.detail}
        </p>
      )}
    </li>
  );
}

/**
 * A target the picker would not offer: deleted (until v0.7 cleans these up, D-12) or, in
 * hand-edited data, a field conditions cannot read. It stays selected, so the select never
 * silently changes what the condition reads, and Save says what is wrong.
 */
function unavailableTargetName(condition: Condition, fields: readonly Field[]): string {
  const index = fields.findIndex((field) => field.id === condition.targetFieldId);
  const field = fields[index];
  return field ? `${positionName(field, index)} (can’t be used in conditions)` : 'Removed field';
}
