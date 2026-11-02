import { numberOf } from '../../domain/values';
import { displayLabel } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { formatNumber } from '../shared/format';
import styles from './Calculation.module.css';
import { AGGREGATION_NAMES, listNames } from './definition';

/**
 * Read-only by construction: an `<output>`, not a disabled input, so it is never in the tab
 * order as something to type into. Its value is the engine's result (ADR 0018), so it updates
 * as the respondent types in a source. Updates are not spoken on every keystroke
 * (`aria-live="off"` overrides the output's implicit status role), so typing does not flood a
 * screen reader; the result is read when the respondent reaches it.
 */
export function CalculationRenderer({
  field,
  value,
  controlId,
  context,
}: RendererProps<'calculation'>) {
  const result = numberOf(value);
  const sources = field.config.sourceFieldIds.flatMap((id) => {
    const source = context.fields.find((candidate) => candidate.id === id);
    return source ? [displayLabel(source.label)] : [];
  });
  return (
    <div className={styles.calculation}>
      <span id={`${controlId}-label`} className={styles.label}>
        {displayLabel(field.label)}
      </span>
      <output
        id={controlId}
        aria-labelledby={`${controlId}-label`}
        aria-describedby={`${controlId}-hint`}
        aria-live="off"
        className={styles.output}
      >
        {result === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="visually-hidden">Nothing to calculate yet</span>
          </>
        ) : (
          formatNumber(result, field.config.decimals)
        )}
      </output>
      <span id={`${controlId}-hint`} className={styles.hint}>
        {sources.length > 0
          ? `${AGGREGATION_NAMES[field.config.aggregation]} of ${listNames(sources)}. Empty and hidden answers are left out.`
          : 'Calculated from other answers.'}
      </span>
    </div>
  );
}
