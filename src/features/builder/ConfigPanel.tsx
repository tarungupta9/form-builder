import type { DependencyGraph } from '../../domain/rules/graph';
import { type Field, type FormTemplate, takesAnswer } from '../../domain/template';
import { definitionOf } from '../../fields/registry';
import { uiOf } from '../../fields/ui-registry';
import { Setting, controlClass } from '../../ui/Setting';
import styles from './Builder.module.css';
import { CONFIG_IDS } from './configIds';
import { type ConfigIssue, LABEL_MISSING } from './configIssues';
import type { ConditionWarning } from './conditions/conditionWarnings';
import { RequiredSettings } from './conditions/RequiredSettings';
import { useWarningAnnouncements } from './conditions/useWarningAnnouncements';
import { VisibilitySettings } from './conditions/VisibilitySettings';

interface ConfigPanelProps {
  template: FormTemplate;
  /** The template's dependency graph, which the condition editor needs to refuse loops. */
  graph: DependencyGraph;
  selectedField: Field | null;
  fieldIssues: readonly ConfigIssue[];
  /** The selected field's warnings, shown live; unlike issues, they never block Save. */
  fieldWarnings: readonly ConditionWarning[];
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
  graph,
  fieldIssues,
  fieldWarnings,
  showIssues,
  onFieldChange,
}: ConfigPanelProps & { field: Field }) {
  const labelMissing = fieldIssues.some((issue) => issue.message === LABEL_MISSING);
  const { Editor } = uiOf(field);
  useWarningAnnouncements(field.id, fieldWarnings);
  const logicProps = {
    field,
    fields: template.fields,
    graph,
    warnings: fieldWarnings,
    showIssues,
    onChange: onFieldChange,
  };
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
          error={showIssues && labelMissing ? LABEL_MISSING : null}
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
        <Editor field={field} context={{ fields: template.fields }} onChange={onFieldChange} />
        {/* Keyed by field, so a condition's half-typed number never carries over to another field. */}
        {takesAnswer(field) && (
          <RequiredSettings key={`required-${field.id}`} {...logicProps} field={field} />
        )}
        <VisibilitySettings key={`visibility-${field.id}`} {...logicProps} />
      </div>
    </>
  );
}
