import { useId } from 'react';
import { assertNever } from '../../domain/assertNever';
import type { ExportBlock, ExportValue } from '../../fields/contract';
import { formatSubmittedAt } from '../../ui/format';
import type { ExportDocument } from './exportModel';
import styles from './ResponseDocument.module.css';

type AnswerBlock = Extract<ExportBlock, { kind: 'answer' }>;
type SectionBlock = Extract<ExportBlock, { kind: 'section' }>;

/** Consecutive answers share one description list; a section heading ends it. */
type Part = { kind: 'answers'; answers: AnswerBlock[] } | SectionBlock;

function toParts(blocks: readonly ExportBlock[]): Part[] {
  const parts: Part[] = [];
  for (const block of blocks) {
    const last = parts.at(-1);
    if (block.kind === 'section') parts.push(block);
    else if (last?.kind === 'answers') last.answers.push(block);
    else parts.push({ kind: 'answers', answers: [block] });
  }
  return parts;
}

/**
 * A submitted response as a document: the form's title, when it was submitted, then every
 * answer in form order. It is the one view of a response, printed to PDF by `printDocument`
 * and shown on screen as it is, so the two cannot disagree (ADR 0011). It is presentational and
 * makes no print assumptions; page size, page numbers and page breaks live in `print.css`.
 */
export function ResponseDocument({ document }: { document: ExportDocument }) {
  const titleId = useId();
  return (
    <article aria-labelledby={titleId} className={styles.document}>
      <header className={styles.header}>
        {/* tabIndex -1: the page's heading, which the app shell focuses after a navigation. */}
        <h1 id={titleId} tabIndex={-1} className={styles.title}>
          {document.title}
        </h1>
        {document.description && <p className={styles.description}>{document.description}</p>}
        <dl className={styles.meta}>
          <div>
            <dt>Submitted</dt>
            <dd>
              <time dateTime={document.submittedAt}>{formatSubmittedAt(document.submittedAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Response ID</dt>
            <dd>
              <code className={styles.id}>{document.responseId}</code>
            </dd>
          </div>
        </dl>
      </header>

      {toParts(document.blocks).map((part, index) =>
        part.kind === 'answers' ? (
          // Blocks have no IDs, and the list never changes once built: position is identity.
          <dl key={index} className={styles.answers}>
            {part.answers.map((answer, answerIndex) => (
              <div key={answerIndex} className={styles.row}>
                <dt className={styles.label}>{answer.label}</dt>
                <dd className={styles.value}>
                  <AnswerValue value={answer.value} />
                  {answer.note && <p className={styles.note}>{answer.note}</p>}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <SectionHeading key={index} section={part} />
        ),
      )}
    </article>
  );
}

function SectionHeading({ section }: { section: SectionBlock }) {
  const Heading = `h${section.level}` as const;
  return <Heading className={styles.section}>{section.text}</Heading>;
}

function AnswerValue({ value }: { value: ExportValue }) {
  switch (value.kind) {
    case 'empty':
      // Muted by colour and by wording, so it still reads in print, where backgrounds are dropped.
      return <span className={styles.empty}>{value.text ?? 'Not answered'}</span>;
    case 'text':
      return <span className={styles.text}>{value.text}</span>;
    case 'list':
      return (
        <ul className={styles.list}>
          {value.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );
    default:
      return assertNever(value);
  }
}
