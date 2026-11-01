import type { RendererProps } from '../contract';
import { HEADING_LEVEL, headingText } from './definition';
import styles from './Section.module.css';

/** A real heading element at the size's level, so screen reader users can navigate by it. */
export function SectionRenderer({ field, controlId }: RendererProps<'section'>) {
  const Heading = `h${HEADING_LEVEL[field.config.size]}` as const;
  return (
    <Heading id={controlId} className={[styles.heading, styles[field.config.size]].join(' ')}>
      {headingText(field.label)}
    </Heading>
  );
}
