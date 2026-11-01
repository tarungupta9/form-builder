import { OptionalNumberInput, Setting } from '../../ui/Setting';
import styles from './Settings.module.css';

interface LengthSettingsProps {
  minLength: number | undefined;
  maxLength: number | undefined;
  onChange: (limits: { minLength: number | undefined; maxLength: number | undefined }) => void;
  error?: string | null;
}

/** Minimum and maximum character length, shared by Short text and Long text. */
export function LengthSettings({
  minLength,
  maxLength,
  onChange,
  error = null,
}: LengthSettingsProps) {
  return (
    <div className={styles.pair}>
      <Setting label="Minimum characters" error={error}>
        {(control) => (
          <OptionalNumberInput
            {...control}
            integer
            value={minLength}
            onChange={(next) => {
              onChange({ minLength: next, maxLength });
            }}
          />
        )}
      </Setting>
      <Setting label="Maximum characters">
        {(control) => (
          <OptionalNumberInput
            {...control}
            integer
            value={maxLength}
            onChange={(next) => {
              onChange({ minLength, maxLength: next });
            }}
          />
        )}
      </Setting>
    </div>
  );
}
