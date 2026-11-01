import { Setting, controlClass } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import { LengthSettings } from '../shared/LengthSettings';
import styles from '../shared/Settings.module.css';
import { lengthConfigIssues } from '../shared/textRules';

export function TextEditor({ field, onChange }: EditorProps<'text'>) {
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
      <div className={styles.pair}>
        <Setting label="Prefix" hint="Before the box, like https://">
          {(control) => (
            <input
              {...control}
              className={controlClass}
              value={config.prefix}
              onChange={(event) => {
                update({ prefix: event.target.value });
              }}
            />
          )}
        </Setting>
        <Setting label="Suffix" hint="After the box, like .com">
          {(control) => (
            <input
              {...control}
              className={controlClass}
              value={config.suffix}
              onChange={(event) => {
                update({ suffix: event.target.value });
              }}
            />
          )}
        </Setting>
      </div>
    </div>
  );
}
