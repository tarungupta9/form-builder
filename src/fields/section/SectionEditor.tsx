import type { Field, FieldOf, SectionSize } from '../../domain/template';
import { Setting, selectClass } from '../../ui/Setting';
import type { EditorProps, HeadingLevel } from '../contract';
import { HEADING_LEVEL, SIZE_NAMES } from './definition';
import styles from './Section.module.css';

const SIZES: readonly SectionSize[] = ['xl', 'lg', 'md', 'sm', 'xs'];

/** The level of the nearest section header above `id`, or 1 for the form title. */
function levelAbove(fields: readonly Field[], id: Field['id']): HeadingLevel | 1 {
  const index = fields.findIndex((field) => field.id === id);
  for (let i = index - 1; i >= 0; i -= 1) {
    const field = fields[i];
    if (field?.type === 'section') return HEADING_LEVEL[field.config.size];
  }
  return 1;
}

/**
 * The hint when this header skips a level (an `h2` followed by an `h4`), which makes the page
 * outline harder to follow for screen reader users (D-18). Advice only: it never blocks Save.
 */
function skipHint(fields: readonly Field[], field: FieldOf<'section'>): string | null {
  const above = levelAbove(fields, field.id);
  if (HEADING_LEVEL[field.config.size] <= above + 1) return null;
  const after = above === 1 ? 'the form title' : 'the section header above';
  return `This skips a heading level after ${after}. Screen reader users move through a form by its headings, so consider a larger size.`;
}

export function SectionEditor({ field, context, onChange }: EditorProps<'section'>) {
  return (
    <>
      <Setting
        label="Size"
        hint="Each size is a heading level, on the page and in the PDF. Larger sizes start bigger parts."
      >
        {(control) => (
          <select
            {...control}
            className={selectClass}
            value={field.config.size}
            onChange={(event) => {
              const size = SIZES.find((candidate) => candidate === event.target.value);
              if (size) onChange({ ...field, config: { size } });
            }}
          >
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {SIZE_NAMES[size]}
              </option>
            ))}
          </select>
        )}
      </Setting>
      {/* Always in the page, so a hint appearing after a size change is announced. */}
      <p role="status" className={styles.skipHint}>
        {skipHint(context.fields, field)}
      </p>
    </>
  );
}
