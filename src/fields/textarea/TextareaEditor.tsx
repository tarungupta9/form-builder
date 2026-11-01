import { OptionalNumberInput, Setting, controlClass } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import { LengthSettings } from '../shared/LengthSettings';
import styles from '../shared/Settings.module.css';
import { lengthConfigIssues } from '../shared/textRules';
import { MAX_ROWS, MIN_ROWS, rowsIssue } from './definition';

export function TextareaEditor({ field, onChange }: EditorProps<'textarea'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  return (
    <div className={styles.stack}>
      <Setting label="Placeholder" hint="Example text shown in the empty box.">
        {(control) => (
          <input
            {...control}
            className={controlClass}
            value={config.placeholder}
            onChange={(event) => {
              update({ placeholder: event.target.value });
            }}
          />
        )}
      </Setting>
      <LengthSettings
        minLength={config.minLength}
        maxLength={config.maxLength}
        error={lengthConfigIssues(config)[0] ?? null}
        onChange={update}
      />
      <Setting
        label="Visible rows"
        hint={`How tall the box is, from ${MIN_ROWS} to ${MAX_ROWS} rows.`}
        error={rowsIssue(config.rows)}
      >
        {(control) => (
          <OptionalNumberInput
            {...control}
            integer
            value={config.rows}
            onChange={(rows) => {
              // Rows are always set; clearing the box keeps the last count until a new one is typed.
              if (rows !== undefined) update({ rows });
            }}
          />
        )}
      </Setting>
    </div>
  );
}
