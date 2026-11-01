import { FormField } from '../../ui/FormField';
import type { RendererProps } from '../contract';
import { answerStyles } from '../shared/Adorned';
import { lengthHint } from '../shared/textRules';

export function TextareaRenderer({
  field,
  value,
  required,
  error,
  controlId,
  onChange,
}: RendererProps<'textarea'>) {
  return (
    <FormField
      id={controlId}
      label={field.label}
      required={required}
      hint={lengthHint(field.config)}
      error={error}
    >
      {(control) => (
        <textarea
          {...control}
          className={answerStyles.answer}
          rows={field.config.rows}
          placeholder={field.config.placeholder || undefined}
          value={value?.value ?? ''}
          onChange={(event) => {
            onChange({ kind: 'text', value: event.target.value });
          }}
        />
      )}
    </FormField>
  );
}
