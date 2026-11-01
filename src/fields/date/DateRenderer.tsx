import { type IsoDate, parseIsoDate } from '../../domain/ids';
import { FormField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { answerStyles } from '../shared/Adorned';
import { formatIsoDate } from '../shared/format';

function rangeHint(min: IsoDate | undefined, max: IsoDate | undefined): string | null {
  if (min && max) return `Between ${formatIsoDate(min)} and ${formatIsoDate(max)}.`;
  if (min) return `On or after ${formatIsoDate(min)}.`;
  if (max) return `On or before ${formatIsoDate(max)}.`;
  return null;
}

/** The native date input: a keyboard-accessible picker in every browser, with no extra code. */
export function DateRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'date'>) {
  const { minDate, maxDate } = field.config;
  return (
    <FormField
      id={controlId}
      label={field.label}
      required={required}
      hint={rangeHint(minDate, maxDate)}
      error={error}
    >
      {(control) => (
        <input
          {...control}
          type="date"
          className={[answerStyles.answer, answerStyles.narrow].join(' ')}
          min={minDate}
          max={maxDate}
          value={value?.value ?? ''}
          onChange={(event) => {
            // A cleared or half-typed date reads as no date.
            onChange({ kind: 'date', value: parseIsoDate(event.target.value) });
          }}
        />
      )}
    </FormField>
  );
}
