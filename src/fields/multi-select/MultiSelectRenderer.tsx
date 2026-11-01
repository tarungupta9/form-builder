import { FieldsetField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import choiceStyles from '../shared/Choice.module.css';
import { selectionHint } from './selectionRules';

/**
 * Native checkboxes under a `<legend>`. The checkboxes carry no `required`: on a checkbox it
 * means "this box must be ticked", which is not the rule; the legend's Required tag says it.
 */
export function MultiSelectRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'multiSelect'>) {
  const { options } = field.config;
  const selected = new Set(value?.value ?? []);
  return (
    <FieldsetField
      id={controlId}
      label={field.label}
      required={required}
      hint={selectionHint(field.config)}
      error={error}
    >
      <div className={choiceStyles.stack}>
        {options.map((option, index) => (
          <label key={option.id} className={choiceStyles.choice}>
            <input
              type="checkbox"
              // The error summary links to the first option, which moves focus into the group.
              id={index === 0 ? controlId : undefined}
              value={option.id}
              checked={selected.has(option.id)}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                const ticked = event.target.checked;
                // Kept in option order, so the stored answer does not depend on tick order.
                const next = options.filter((o) =>
                  o.id === option.id ? ticked : selected.has(o.id),
                );
                onChange({ kind: 'multi', value: next.map((o) => o.id) });
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldsetField>
  );
}
