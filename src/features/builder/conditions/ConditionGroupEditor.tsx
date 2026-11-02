import type { FieldId } from '../../../domain/ids';
import type { ConditionGroup, Field } from '../../../domain/template';
import { Button } from '../../../ui/Button';
import { useAnnounce } from '../../../ui/LiveRegion';
import { selectClass } from '../../../ui/Setting';
import { useFocusRequest } from '../../../ui/useFocusRequest';
import { type GroupCopy, conditionControlId } from './conditionGroups';
import type { ConditionIssue } from './conditionIssues';
import { type TargetChoice, newCondition } from './conditionTargets';
import styles from './Conditions.module.css';
import { ConditionRow } from './ConditionRow';

interface ConditionGroupEditorProps {
  /** Unique within the panel ("show", "hide"), for the group's own element IDs. */
  groupKey: string;
  copy: GroupCopy;
  group: ConditionGroup;
  ownerId: FieldId;
  fields: readonly Field[];
  choices: readonly TargetChoice[];
  loopHintId: string | undefined;
  /** A static note under the sentence, such as the visible-by-default hint (D6-6). */
  note: string | null;
  issues: readonly ConditionIssue[];
  onChange: (group: ConditionGroup) => void;
}

const MATCH_HINT = 'All: every condition must match. Any: one is enough.';

/**
 * One condition group, read as a sentence: "Show this field when [all] of these match". It
 * knows nothing about which effect it edits; the copy says it. Rows are keyed by condition ID,
 * so changing a row's target swaps its inputs without moving focus.
 *
 * Focus is placed after every action: Add focuses the new row's field select, Remove the next
 * row's (else the previous one's, else Add). Both are announced.
 */
export function ConditionGroupEditor({
  groupKey,
  copy,
  group,
  ownerId,
  fields,
  choices,
  loopHintId,
  note,
  issues,
  onChange,
}: ConditionGroupEditorProps) {
  const announce = useAnnounce();
  const focusLater = useFocusRequest();
  const baseId = `${groupKey}-group-${ownerId}`;
  const ids = {
    lead: `${baseId}-lead`,
    match: `${baseId}-match`,
    tail: `${baseId}-tail`,
    matchHint: `${baseId}-match-hint`,
    add: `${baseId}-add`,
    addHint: `${baseId}-add-hint`,
  };
  const { conditions } = group;
  const addBlockedReason =
    choices.length === 0
      ? 'Add another field first: a condition reads another field’s answer.'
      : choices.every((choice) => choice.disabledReason !== null)
        ? 'Every other field already depends on this one, so a condition here would make a loop.'
        : null;

  const add = () => {
    const added = newCondition(fields, choices, ownerId);
    if (!added) return;
    onChange({ ...group, conditions: [...conditions, added] });
    focusLater(conditionControlId(added.id, 'target'));
    announce(`${copy.noun} ${conditions.length + 1} added`);
  };

  const remove = (index: number) => {
    const removed = conditions[index];
    if (!removed) return;
    onChange({ ...group, conditions: conditions.filter((c) => c.id !== removed.id) });
    const neighbour = conditions[index + 1] ?? conditions[index - 1];
    focusLater(neighbour ? conditionControlId(neighbour.id, 'target') : ids.add);
    announce(`${copy.noun} ${index + 1} removed`);
  };

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{copy.title}</legend>
      {conditions.length === 0 ? (
        <p className={styles.empty}>No conditions.</p>
      ) : (
        <>
          {/* The select is named by the whole sentence, so it reads "Show this field when all
              of these match" in a screen reader too. */}
          <p className={styles.sentence}>
            <span id={ids.lead}>{copy.lead}</span>
            <select
              id={ids.match}
              aria-labelledby={`${ids.lead} ${ids.match} ${ids.tail}`}
              aria-describedby={ids.matchHint}
              className={[selectClass, styles.match].join(' ')}
              value={group.match}
              onChange={(event) => {
                onChange({ ...group, match: event.target.value === 'any' ? 'any' : 'all' });
              }}
            >
              <option value="all">all</option>
              <option value="any">any</option>
            </select>
            <span id={ids.tail}>of these match</span>
          </p>
          <p id={ids.matchHint} className={styles.hint}>
            {MATCH_HINT}
          </p>
          {note && <p className={styles.note}>{note}</p>}
          <ol className={styles.rows}>
            {conditions.map((condition, index) => (
              <ConditionRow
                key={condition.id}
                condition={condition}
                name={`${copy.noun} ${index + 1}`}
                fields={fields}
                choices={choices}
                loopHintId={loopHintId}
                issue={issues.find((issue) => issue.conditionId === condition.id)}
                onChange={(next) => {
                  onChange({
                    ...group,
                    conditions: conditions.map((c) => (c.id === next.id ? next : c)),
                  });
                }}
                onRemove={() => {
                  remove(index);
                }}
              />
            ))}
          </ol>
        </>
      )}
      <Button
        id={ids.add}
        variant="dashed"
        size="sm"
        icon="plus"
        disabled={addBlockedReason !== null}
        aria-describedby={addBlockedReason ? ids.addHint : undefined}
        onClick={add}
      >
        Add a {copy.noun.toLowerCase()}
      </Button>
      {addBlockedReason && (
        <p id={ids.addHint} className={styles.hint}>
          {addBlockedReason}
        </p>
      )}
    </fieldset>
  );
}
