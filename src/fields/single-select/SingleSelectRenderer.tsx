import { useRef } from 'react';
import type { OptionId } from '../../domain/ids';
import { Button } from '../../ui/Button';
import { FieldsetField, FormField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { answerStyles } from '../shared/Adorned';
import choiceStyles from '../shared/Choice.module.css';

/**
 * Radio, dropdown and tiles are three looks for one control. Tiles are native radios styled as
 * cards, so selection, arrow-key movement and required validation are the browser's own in
 * both radio looks, and the dropdown is a native `<select>`. All three emit the same value,
 * and every control carries native `required`. ARIA has no invalid state for a single radio, so
 * the radio looks report an error through the group's description (`FieldsetField`) and the
 * select through its own, with `aria-invalid`.
 */
export function SingleSelectRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'singleSelect'>) {
  const { options, display } = field.config;
  const selected = value?.value ?? null;
  const firstRadio = useRef<HTMLInputElement>(null);
  const select = (id: OptionId | null) => {
    onChange({ kind: 'choice', value: id });
  };

  if (display === 'dropdown') {
    return (
      <FormField id={controlId} label={field.label} required={required} error={error}>
        {(control) => (
          <select
            {...control}
            required={required}
            className={[answerStyles.answer, choiceStyles.select].join(' ')}
            value={selected ?? ''}
            onChange={(event) => {
              select(options.find((option) => option.id === event.target.value)?.id ?? null);
            }}
          >
            {/* Always offered, even when required: a preselected first option would answer
                the question for the respondent, which a radio group never does (O-14). */}
            <option value="">Choose an option</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  }

  const isTiles = display === 'tiles';
  return (
    <FieldsetField id={controlId} label={field.label} required={required} error={error}>
      <div className={isTiles ? choiceStyles.tiles : choiceStyles.stack}>
        {options.map((option, index) => (
          <label key={option.id} className={isTiles ? choiceStyles.tile : choiceStyles.choice}>
            <input
              ref={index === 0 ? firstRadio : undefined}
              type="radio"
              // The error summary links to the first option, which moves focus into the group.
              id={index === 0 ? controlId : undefined}
              name={controlId}
              value={option.id}
              checked={selected === option.id}
              required={required}
              onChange={() => {
                select(option.id);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
      {/* A radio cannot be unticked, so an optional field offers a way back to no answer (O-15). */}
      {!required && selected !== null && (
        <Button
          variant="quiet"
          size="sm"
          className={choiceStyles.clear}
          onClick={() => {
            // The button disappears once nothing is selected; focus goes back into the group.
            firstRadio.current?.focus();
            select(null);
          }}
        >
          Clear answer
        </Button>
      )}
    </FieldsetField>
  );
}
