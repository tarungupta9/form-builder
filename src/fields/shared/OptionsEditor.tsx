import { useId, useState } from 'react';
import { type OptionId, newOptionId } from '../../domain/ids';
import type { Dependant } from '../../domain/rules/references';
import type { Option } from '../../domain/template';
import { Button, IconButton } from '../../ui/Button';
import { useAnnounce } from '../../ui/LiveRegion';
import { RemovalDialog, removedConditions } from '../../ui/RemovalDialog';
import { controlClass } from '../../ui/Setting';
import { useFocusRequest } from '../../ui/useFocusRequest';
import styles from './OptionsEditor.module.css';
import { nextOptionLabel, optionListIssues } from './options';

interface OptionsEditorProps {
  options: readonly Option[];
  /** The fields whose conditions compare with an option, so removing it can ask first. */
  usedBy: (optionId: OptionId) => readonly Dependant[];
  onChange: (options: Option[]) => void;
}

/** An option others compare with, waiting for the author to confirm its removal. */
interface PendingRemoval {
  option: Option;
  name: string;
  dependants: readonly Dependant[];
  focusAfter: string;
  open: boolean;
}

type Direction = 'up' | 'down';

/** Labels that clash with another option's, compared the way `optionListIssues` compares them. */
function clashingLabels(options: readonly Option[]): Set<string> {
  const seen = new Set<string>();
  const clashes = new Set<string>();
  for (const { label } of options) {
    const key = label.trim().toLocaleLowerCase();
    if (key === '') continue;
    if (seen.has(key)) clashes.add(key);
    seen.add(key);
  }
  return clashes;
}

/**
 * Add, rename, reorder and remove the options of a single or multi select, all by keyboard.
 * Options keep their IDs when renamed or moved, so answers that refer to them survive (D-11).
 *
 * Focus is placed on purpose after every action, because each one re-renders the row it came
 * from: Add focuses the new label, Remove the neighbouring label, and Move keeps focus on the
 * moved option's button (or its other move button, once it reaches the end of the list).
 *
 * Removing an option that conditions compare with asks first and names those fields; on
 * confirm, the builder removes the conditions with it, as it does for a removed field (D-12).
 * The dialog then owns focus, so Remove sets none of its own on that path.
 */
export function OptionsEditor({ options, usedBy, onChange }: OptionsEditorProps) {
  const baseId = useId();
  const announce = useAnnounce();
  const focusLater = useFocusRequest();
  const labelId = (id: OptionId) => `${baseId}-${id}-label`;
  const moveId = (id: OptionId, direction: Direction) => `${baseId}-${id}-${direction}`;
  const errorId = `${baseId}-error`;
  const addId = `${baseId}-add`;

  const issues = optionListIssues(options);
  const clashes = clashingLabels(options);
  const [removal, setRemoval] = useState<PendingRemoval | null>(null);

  const remove = (option: Option, index: number, name: string) => {
    const neighbour = options[index + 1] ?? options[index - 1];
    // Remove is disabled on the last option, so there is always a neighbour; Add is a safe default.
    const focusAfter = neighbour ? labelId(neighbour.id) : addId;
    const dependants = usedBy(option.id);
    if (dependants.length > 0) {
      setRemoval({ option, name, dependants, focusAfter, open: true });
      return;
    }
    onChange(options.filter((o) => o.id !== option.id));
    focusLater(focusAfter);
    announce(`${name} removed`);
  };

  const closeRemoval = () => {
    setRemoval((pending) => pending && { ...pending, open: false });
  };

  const move = (index: number, direction: Direction) => {
    const to = direction === 'up' ? index - 1 : index + 1;
    const moved = options[index];
    if (!moved || to < 0 || to >= options.length) return;
    const next = options.filter((option) => option.id !== moved.id);
    next.splice(to, 0, moved);
    onChange(next);
    const atEnd = direction === 'up' ? to === 0 : to === options.length - 1;
    // A disabled button cannot hold focus, so at the end of the list focus goes to the other one.
    focusLater(moveId(moved.id, atEnd ? (direction === 'up' ? 'down' : 'up') : direction));
    announce(`${moved.label.trim() || 'Option'} moved to position ${to + 1} of ${options.length}`);
  };

  return (
    <>
      <fieldset
        className={styles.fieldset}
        aria-describedby={issues.length > 0 ? errorId : undefined}
      >
        <legend className={styles.legend}>Options</legend>
        <ol className={styles.list}>
          {options.map((option, index) => {
            const name = option.label.trim() || `option ${index + 1}`;
            const key = option.label.trim().toLocaleLowerCase();
            const invalid = key === '' || clashes.has(key);
            return (
              <li key={option.id} className={styles.row}>
                <input
                  id={labelId(option.id)}
                  aria-label={`Option ${index + 1} label`}
                  className={controlClass}
                  value={option.label}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? errorId : undefined}
                  onChange={(event) => {
                    onChange(
                      options.map((o) =>
                        o.id === option.id ? { ...o, label: event.target.value } : o,
                      ),
                    );
                  }}
                />
                <IconButton
                  id={moveId(option.id, 'up')}
                  icon="chevronUp"
                  label={`Move ${name} up`}
                  disabled={index === 0}
                  onClick={() => {
                    move(index, 'up');
                  }}
                />
                <IconButton
                  id={moveId(option.id, 'down')}
                  icon="chevronDown"
                  label={`Move ${name} down`}
                  disabled={index === options.length - 1}
                  onClick={() => {
                    move(index, 'down');
                  }}
                />
                <IconButton
                  icon="close"
                  label={`Remove ${name}`}
                  // Both field types need at least one option (O-13).
                  disabled={options.length === 1}
                  onClick={() => {
                    remove(option, index, name);
                  }}
                />
              </li>
            );
          })}
        </ol>
        {issues.length > 0 && (
          <p id={errorId} className={styles.error}>
            {issues[0]}
          </p>
        )}
        <Button
          id={addId}
          variant="dashed"
          size="sm"
          icon="plus"
          onClick={() => {
            const added: Option = { id: newOptionId(), label: nextOptionLabel(options) };
            onChange([...options, added]);
            focusLater(labelId(added.id));
            announce(`${added.label} added`);
          }}
        >
          Add option
        </Button>
      </fieldset>
      <RemovalDialog
        open={removal?.open ?? false}
        title={`Remove ${removal?.name ?? 'option'}?`}
        lead={`Conditions compare with ${removal?.name ?? 'this option'}. Removing it also removes those conditions:`}
        dependants={removal?.dependants ?? []}
        confirmLabel="Remove option and conditions"
        fallbackFocusId={removal?.focusAfter ?? addId}
        onCancel={closeRemoval}
        onConfirm={() => {
          if (!removal) return;
          onChange(options.filter((o) => o.id !== removal.option.id));
          closeRemoval();
          announce(`${removal.name} removed, and ${removedConditions(removal.dependants)}.`);
        }}
      />
    </>
  );
}
