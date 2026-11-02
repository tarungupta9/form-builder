import { useEffect, useState } from 'react';
import { OptionalNumberInput, Setting, controlClass } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import styles from '../shared/Settings.module.css';
import { normaliseFileTypes } from './fileTypes';

export function FileEditor({ field, onChange }: EditorProps<'file'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  // The author's text is kept while they type; the normalised list is what is saved (D-17).
  const [typesText, setTypesText] = useState(config.allowedTypes.join(', '));
  useEffect(() => {
    setTypesText((text) =>
      normaliseFileTypes(text).join(',') === config.allowedTypes.join(',')
        ? text
        : config.allowedTypes.join(', '),
    );
  }, [config.allowedTypes]);

  return (
    <div className={styles.stack}>
      <Setting
        label="Allowed file types"
        hint="Separate with commas, like PDF, .jpg, image/*. Leave empty to allow any file."
      >
        {(control) => (
          <input
            {...control}
            className={controlClass}
            value={typesText}
            onChange={(event) => {
              setTypesText(event.target.value);
              update({ allowedTypes: normaliseFileTypes(event.target.value) });
            }}
            onBlur={() => {
              setTypesText(config.allowedTypes.join(', '));
            }}
          />
        )}
      </Setting>
      <Setting label="Maximum number of files" hint="Leave empty for no limit.">
        {(control) => (
          <OptionalNumberInput
            {...control}
            integer
            value={config.maxFiles}
            onChange={(maxFiles) => {
              update({ maxFiles: maxFiles === 0 ? undefined : maxFiles });
            }}
          />
        )}
      </Setting>
    </div>
  );
}
