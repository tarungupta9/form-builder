import { parseIsoDate } from '../../domain/ids';
import { Setting, controlClass } from '../../ui/Setting';
import { Switch } from '../../ui/Switch';
import type { EditorProps } from '../contract';
import styles from '../shared/Settings.module.css';
import { dateRangeIssue } from './definition';

export function DateEditor({ field, onChange }: EditorProps<'date'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  return (
    <div className={styles.stack}>
      <Switch
        label="Start with today's date"
        description="Each new response opens with the respondent's date filled in."
        checked={config.prefillToday}
        onChange={(prefillToday) => {
          update({ prefillToday });
        }}
      />
      <div className={styles.pair}>
        <Setting label="Earliest date" error={dateRangeIssue(config)}>
          {(control) => (
            <input
              {...control}
              type="date"
              className={controlClass}
              value={config.minDate ?? ''}
              onChange={(event) => {
                update({ minDate: parseIsoDate(event.target.value) ?? undefined });
              }}
            />
          )}
        </Setting>
        <Setting label="Latest date">
          {(control) => (
            <input
              {...control}
              type="date"
              className={controlClass}
              value={config.maxDate ?? ''}
              onChange={(event) => {
                update({ maxDate: parseIsoDate(event.target.value) ?? undefined });
              }}
            />
          )}
        </Setting>
      </div>
    </div>
  );
}
