import { OptionalNumberInput, Setting } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import { OptionsEditor } from '../shared/OptionsEditor';
import styles from '../shared/Settings.module.css';
import { selectionLimitIssues } from './selectionRules';

export function MultiSelectEditor({ field, onChange }: EditorProps<'multiSelect'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  const issues = selectionLimitIssues(config);
  return (
    <div className={styles.stack}>
      <OptionsEditor
        options={config.options}
        onChange={(options) => {
          update({ options });
        }}
      />
      <div className={styles.pair}>
        <Setting label="Minimum choices" error={issues.min}>
          {(control) => (
            <OptionalNumberInput
              {...control}
              integer
              value={config.minSelections}
              onChange={(minSelections) => {
                update({ minSelections });
              }}
            />
          )}
        </Setting>
        <Setting label="Maximum choices" error={issues.max}>
          {(control) => (
            <OptionalNumberInput
              {...control}
              integer
              value={config.maxSelections}
              onChange={(maxSelections) => {
                update({ maxSelections });
              }}
            />
          )}
        </Setting>
      </div>
    </div>
  );
}
