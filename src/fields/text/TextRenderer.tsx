import { FormField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { Adorned, adornmentIds, answerStyles } from '../shared/Adorned';
import { lengthHint } from '../shared/textRules';

export function TextRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'text'>) {
  const { placeholder, prefix, suffix } = field.config;
  return (
    <FormField
      id={controlId}
      label={field.label}
      required={required}
      hint={lengthHint(field.config)}
      error={error}
      describedByExtra={adornmentIds(controlId, prefix, suffix)}
    >
      {(control) => (
        <Adorned id={controlId} prefix={prefix} suffix={suffix}>
          <input
            {...control}
            type="text"
            className={answerStyles.answer}
            placeholder={placeholder || undefined}
            value={value?.value ?? ''}
            onChange={(event) => {
              onChange({ kind: 'text', value: event.target.value });
            }}
          />
        </Adorned>
      )}
    </FormField>
  );
}
