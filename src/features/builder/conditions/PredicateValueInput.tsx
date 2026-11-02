import { useEffect, useState } from 'react';
import { assertNever } from '../../../domain/assertNever';
import { parseIsoDate } from '../../../domain/ids';
import type { Option, Predicate, PredicateOf } from '../../../domain/template';
import { parseDecimal } from '../../../domain/values';
import type { ConditionTarget } from '../../../fields/contract';
import { controlClass, selectClass } from '../../../ui/Setting';
import type { ConditionControl } from './conditionGroups';
import styles from './Conditions.module.css';

/** The ID, `aria-invalid` and `aria-describedby` a control carries, from its row. */
export type ControlWiring = (control: ConditionControl) => {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

interface PredicateValueInputProps {
  predicate: Predicate;
  /** How the target reads; its options for a choice. `null` when the target is gone. */
  target: ConditionTarget | null;
  /** "Show condition 1", the start of each control's accessible name. */
  name: string;
  wiring: ControlWiring;
  onChange: (predicate: Predicate) => void;
}

const optionsOf = (target: ConditionTarget | null): readonly Option[] =>
  target?.kind === 'choice' || target?.kind === 'multi' ? target.options : [];

/**
 * The value a condition compares against. The input follows the predicate's kind, never the
 * field type, so a new field type that reuses a kind needs nothing here. Every control is a
 * native, labelled element.
 */
export function PredicateValueInput({
  predicate,
  target,
  name,
  wiring,
  onChange,
}: PredicateValueInputProps) {
  switch (predicate.kind) {
    case 'text':
      return (
        <input
          {...wiring('value')}
          aria-label={`${name}: value`}
          className={controlClass}
          value={predicate.value}
          onChange={(event) => {
            onChange({ ...predicate, value: event.target.value });
          }}
        />
      );
    case 'number':
      return <NumberValue predicate={predicate} name={name} wiring={wiring} onChange={onChange} />;
    case 'date':
      return (
        <input
          {...wiring('value')}
          type="date"
          aria-label={`${name}: value`}
          className={controlClass}
          value={predicate.value ?? ''}
          onChange={(event) => {
            onChange({ ...predicate, value: parseIsoDate(event.target.value) });
          }}
        />
      );
    case 'choice':
      return (
        <ChoiceValue
          predicate={predicate}
          options={optionsOf(target)}
          name={name}
          wiring={wiring}
          onChange={onChange}
        />
      );
    case 'multi':
      return (
        <MultiValue
          predicate={predicate}
          options={optionsOf(target)}
          name={name}
          wiring={wiring}
          onChange={onChange}
        />
      );
    default:
      return assertNever(predicate);
  }
}

interface KindProps<K extends Predicate['kind']> {
  predicate: PredicateOf<K>;
  name: string;
  wiring: ControlWiring;
  onChange: (predicate: Predicate) => void;
}

function NumberValue({ predicate, name, wiring, onChange }: KindProps<'number'>) {
  if (predicate.op !== 'between') {
    return (
      <NumberText
        {...wiring('value')}
        label={`${name}: value`}
        value={predicate.value}
        onChange={(value) => {
          onChange({ ...predicate, value });
        }}
      />
    );
  }
  const { min, max } = predicate.value;
  return (
    <span className={styles.range}>
      <NumberText
        {...wiring('min')}
        label={`${name}: from`}
        value={min}
        onChange={(next) => {
          onChange({ ...predicate, value: { min: next, max } });
        }}
      />
      <span aria-hidden="true">and</span>
      <NumberText
        {...wiring('max')}
        label={`${name}: to`}
        value={max}
        onChange={(next) => {
          onChange({ ...predicate, value: { min, max: next } });
        }}
      />
    </span>
  );
}

interface NumberTextProps extends ReturnType<ControlWiring> {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * A text box for a number, for the same reasons as the Number field (ADR 0013). It keeps the
 * author's text while they type ("12a", "-"), and reports `null` until the text is a number, so
 * an unfinished condition never holds and blocks Save.
 */
function NumberText({ label, value, onChange, ...control }: NumberTextProps) {
  const [text, setText] = useState(value === null ? '' : String(value));

  // Follow outside changes (another operator keeping the number) without fighting typing.
  useEffect(() => {
    setText((current) =>
      numberIn(current) === value ? current : value === null ? '' : String(value),
    );
  }, [value]);

  const unreadable = text.trim() !== '' && numberIn(text) === null;
  return (
    <input
      {...control}
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={control['aria-invalid'] || unreadable}
      className={[controlClass, styles.number].join(' ')}
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(numberIn(event.target.value));
      }}
    />
  );
}

function numberIn(text: string): number | null {
  const parsed = parseDecimal(text);
  return parsed.status === 'ok' ? parsed.value : null;
}

function ChoiceValue({
  predicate,
  options,
  name,
  wiring,
  onChange,
}: KindProps<'choice'> & { options: readonly Option[] }) {
  const missing = predicate.value !== null && !options.some((o) => o.id === predicate.value);
  return (
    <select
      {...wiring('value')}
      aria-label={`${name}: value`}
      className={selectClass}
      value={predicate.value ?? ''}
      onChange={(event) => {
        const chosen = options.find((option) => option.id === event.target.value);
        onChange({ ...predicate, value: chosen?.id ?? null });
      }}
    >
      <option value="">Choose an option</option>
      {/* Shown rather than silently swapped, so the author sees what Save is about. */}
      {missing && (
        <option value={predicate.value ?? ''} disabled>
          Removed option
        </option>
      )}
      {options.map((option, index) => (
        <option key={option.id} value={option.id}>
          {option.label.trim() || `Option ${index + 1}`}
        </option>
      ))}
    </select>
  );
}

function MultiValue({
  predicate,
  options,
  name,
  wiring,
  onChange,
}: KindProps<'multi'> & { options: readonly Option[] }) {
  const selected = new Set(predicate.value);
  const { id, ...described } = wiring('value');
  return (
    <fieldset className={styles.checkboxes} aria-describedby={described['aria-describedby']}>
      <legend className="visually-hidden">{`${name}: options`}</legend>
      {options.map((option, index) => (
        <label key={option.id} className={styles.checkbox}>
          <input
            type="checkbox"
            // The first box carries the value's ID, so an issue link can land in the group.
            id={index === 0 ? id : undefined}
            aria-invalid={described['aria-invalid']}
            checked={selected.has(option.id)}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.target.checked) next.add(option.id);
              else next.delete(option.id);
              // Kept in option order, like a Multi select answer.
              onChange({
                ...predicate,
                value: options.filter((o) => next.has(o.id)).map((o) => o.id),
              });
            }}
          />
          {option.label.trim() || `Option ${index + 1}`}
        </label>
      ))}
    </fieldset>
  );
}
