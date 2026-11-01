import type { Decimals } from '../../domain/template';
import { OptionalNumberInput, Setting, controlClass, selectClass } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import styles from '../shared/Settings.module.css';
import { maximumIssue, minimumIssue } from './definition';

const DECIMAL_CHOICES: readonly Decimals[] = [0, 1, 2, 3, 4];

export function NumberEditor({ field, onChange }: EditorProps<'number'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  return (
    <div className={styles.stack}>
      <Setting
        label="Decimal places"
        hint="Answers with more decimal places are refused, never rounded."
      >
        {(control) => (
          <select
            {...control}
            className={selectClass}
            value={config.decimals}
            onChange={(event) => {
              const decimals = DECIMAL_CHOICES.find(
                (choice) => String(choice) === event.target.value,
              );
              if (decimals !== undefined) update({ decimals });
            }}
          >
            {DECIMAL_CHOICES.map((choice) => (
              <option key={choice} value={choice}>
                {choice === 0 ? 'None (whole numbers)' : choice}
              </option>
            ))}
          </select>
        )}
      </Setting>
      <div className={styles.pair}>
        <Setting label="Minimum value" error={minimumIssue(config)}>
          {(control) => (
            <OptionalNumberInput
              {...control}
              value={config.min}
              onChange={(min) => {
                update({ min });
              }}
            />
          )}
        </Setting>
        <Setting label="Maximum value" error={maximumIssue(config)}>
          {(control) => (
            <OptionalNumberInput
              {...control}
              value={config.max}
              onChange={(max) => {
                update({ max });
              }}
            />
          )}
        </Setting>
      </div>
      <div className={styles.pair}>
        <Setting label="Prefix" hint="Before the number, like $">
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
        <Setting label="Suffix" hint="After the number, like kg">
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
