import { type Field, type FormTemplate, hasRequiredAxis } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { uiOf } from '../../fields/ui-registry';
import { Setting, controlClass } from '../../ui/Setting';
import { Switch } from '../../ui/Switch';
import styles from './Builder.module.css';
import { LABEL_MISSING } from './configIssues';

/** Fixed IDs the builder moves focus to when the author follows an issue. */
export const CONFIG_IDS = {
  panelTitle: 'config-title',
  fieldLabel: 'field-label',
} as const;

interface ConfigPanelProps {
  template: FormTemplate;
  selectedField: Field | null;
  fieldIssues: readonly string[];
  /** A missing label appears only after a Save attempt, not while the author is typing. */
  showIssues: boolean;
  onFieldChange: (field: Field) => void;
}

/**
 * The selected field's settings. The template's own title and description are edited from the
 * page heading instead (`TemplateDetailsDialog`), so this panel is only ever about one field.
 */
export function ConfigPanel(props: ConfigPanelProps) {
  return (
    <section className={styles.config} aria-labelledby={CONFIG_IDS.panelTitle}>
      {props.selectedField ? (
        <FieldSettings {...props} field={props.selectedField} />
      ) : (
        <NoSelection />
      )}
    </section>
  );
}

function NoSelection() {
  return (
    <>
      <h2 id={CONFIG_IDS.panelTitle} tabIndex={-1} className={styles.panelTitle}>
        Field settings
      </h2>
      <p className={styles.configEmpty}>Select a field to change its settings.</p>
    </>
  );
}

function FieldSettings({
  field,
  template,
  fieldIssues,
  showIssues,
  onFieldChange,
}: ConfigPanelProps & { field: Field }) {
  const { Editor } = uiOf(field);
  const { logic } = field;
  return (
    <>
      <h2 id={CONFIG_IDS.panelTitle} tabIndex={-1} className={styles.panelTitle}>
        {definitionOf(field).paletteLabel} settings
      </h2>
      <div className={styles.settings}>
        <Setting
          id={CONFIG_IDS.fieldLabel}
          label="Label"
          hint="What respondents see."
          error={showIssues && fieldIssues.includes(LABEL_MISSING) ? LABEL_MISSING : null}
        >
          {(control) => (
            <input
              {...control}
              className={controlClass}
              value={field.label}
              onChange={(event) => {
                onFieldChange({ ...field, label: event.target.value });
              }}
            />
          )}
        </Setting>
        {hasRequiredAxis(logic) && (
          <Switch
            label="Required"
            description="Respondents must answer before they can submit."
            checked={logic.defaultRequired}
            onChange={(defaultRequired) => {
              onFieldChange({ ...field, logic: { ...logic, defaultRequired } });
            }}
          />
        )}
        <Editor field={field} context={{ fields: template.fields }} onChange={onFieldChange} />
      </div>
    </>
  );
}
