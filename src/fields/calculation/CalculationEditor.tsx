import type { Aggregation, Decimals } from '../../domain/template';
import { displayLabel } from '../../ui/FormField';
import { Setting, selectClass } from '../../ui/Setting';
import type { EditorProps } from '../contract';
import styles from '../shared/Settings.module.css';
import editorStyles from './CalculationEditor.module.css';
import { AGGREGATION_NAMES, NO_SOURCES, isNumberField } from './definition';

const AGGREGATIONS: readonly Aggregation[] = ['sum', 'average', 'min', 'max'];
const DECIMAL_CHOICES: readonly Decimals[] = [0, 1, 2, 3, 4];

export function CalculationEditor({ field, context, onChange }: EditorProps<'calculation'>) {
  const { config } = field;
  const update = (patch: Partial<typeof config>) => {
    onChange({ ...field, config: { ...config, ...patch } });
  };
  // Only Number fields are offered, so another calculation can never be chosen as a source.
  const numberFields = context.fields.filter(isNumberField);
  const selected = new Set(config.sourceFieldIds);

  return (
    <div className={styles.stack}>
      <fieldset className={editorStyles.sources}>
        <legend className={editorStyles.legend}>Calculate from</legend>
        {numberFields.length === 0 ? (
          <p className={editorStyles.empty}>
            Add a Number field to the form first. Calculations can only use Number fields.
          </p>
        ) : (
          numberFields.map((source) => (
            <label key={source.id} className={editorStyles.source}>
              <input
                type="checkbox"
                checked={selected.has(source.id)}
                onChange={(event) => {
                  // Kept in form order, so the description in Fill reads naturally.
                  const next = numberFields
                    .filter((candidate) =>
                      candidate.id === source.id
                        ? event.target.checked
                        : selected.has(candidate.id),
                    )
                    .map((candidate) => candidate.id);
                  update({ sourceFieldIds: next });
                }}
              />
              {displayLabel(source.label)}
            </label>
          ))
        )}
        {numberFields.length > 0 && selected.size === 0 && (
          <p className={editorStyles.error}>{NO_SOURCES}</p>
        )}
      </fieldset>
      <div className={styles.pair}>
        <Setting label="Calculation">
          {(control) => (
            <select
              {...control}
              className={selectClass}
              value={config.aggregation}
              onChange={(event) => {
                const aggregation = AGGREGATIONS.find(
                  (candidate) => candidate === event.target.value,
                );
                if (aggregation) update({ aggregation });
              }}
            >
              {AGGREGATIONS.map((aggregation) => (
                <option key={aggregation} value={aggregation}>
                  {AGGREGATION_NAMES[aggregation]}
                </option>
              ))}
            </select>
          )}
        </Setting>
        <Setting label="Decimal places">
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
                  {choice === 0 ? 'None' : choice}
                </option>
              ))}
            </select>
          )}
        </Setting>
      </div>
      <p className={editorStyles.note}>
        Empty and hidden answers are left out, so an average only counts the answers given.
      </p>
    </div>
  );
}
