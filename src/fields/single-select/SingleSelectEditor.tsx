import type { SingleSelectDisplay } from '../../domain/template';
import type { EditorProps } from '../contract';
import { optionDependantsOf } from '../../domain/rules/references';
import { OptionsEditor } from '../shared/OptionsEditor';
import styles from '../shared/Settings.module.css';
import segmented from '../shared/Segmented.module.css';

const DISPLAYS: { value: SingleSelectDisplay; label: string }[] = [
  { value: 'radio', label: 'Radio' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'tiles', label: 'Tiles' },
];

export function SingleSelectEditor({ field, context, onChange }: EditorProps<'singleSelect'>) {
  const { config } = field;
  return (
    <div className={styles.stack}>
      <fieldset className={segmented.group}>
        <legend className={segmented.legend}>Display as</legend>
        <div className={segmented.options}>
          {DISPLAYS.map((display) => (
            <label key={display.value} className={segmented.option}>
              <input
                type="radio"
                name={`display-${field.id}`}
                value={display.value}
                checked={config.display === display.value}
                onChange={() => {
                  onChange({ ...field, config: { ...config, display: display.value } });
                }}
              />
              {display.label}
            </label>
          ))}
        </div>
      </fieldset>
      <OptionsEditor
        options={config.options}
        usedBy={(optionId) => optionDependantsOf(context.fields, field.id, optionId)}
        onChange={(options) => {
          onChange({ ...field, config: { ...config, options } });
        }}
      />
    </div>
  );
}
