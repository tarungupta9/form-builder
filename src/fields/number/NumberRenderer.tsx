import type { NumberConfig } from '../../domain/template';
import { plural } from '../../ui/format';
import { FormField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { Adorned, adornmentIds, answerStyles } from '../shared/Adorned';

/** The limits and the precision, so the respondent knows them before submitting. */
function numberHint({ min, max, decimals }: NumberConfig): string {
  const precision =
    decimals === 0 ? 'A whole number' : `Up to ${plural(decimals, 'decimal place')}`;
  if (min !== undefined && max !== undefined) return `${precision}, from ${min} to ${max}.`;
  if (min !== undefined) return `${precision}, ${min} or more.`;
  if (max !== undefined) return `${precision}, ${max} or less.`;
  return `${precision}.`;
}

/**
 * A text box with a numeric keyboard rather than `type="number"`, which changes the value when
 * the page is scrolled over it and accepts input like "1e5" (D-15, ADR 0013).
 */
export function NumberRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'number'>) {
  const { prefix, suffix, decimals } = field.config;
  return (
    <FormField
      id={controlId}
      label={field.label}
      required={required}
      hint={numberHint(field.config)}
      error={error}
      describedByExtra={adornmentIds(controlId, prefix, suffix)}
    >
      {(control) => (
        <div className={answerStyles.narrow}>
          <Adorned id={controlId} prefix={prefix} suffix={suffix}>
            <input
              {...control}
              type="text"
              inputMode={decimals === 0 ? 'numeric' : 'decimal'}
              autoComplete="off"
              className={[answerStyles.answer, answerStyles.number].join(' ')}
              value={value?.input ?? ''}
              onChange={(event) => {
                onChange({ kind: 'number', input: event.target.value });
              }}
            />
          </Adorned>
        </div>
      )}
    </FormField>
  );
}
