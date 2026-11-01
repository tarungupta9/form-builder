import { type RefObject } from 'react';
import type { FieldId } from '../../domain/ids';
import type { Field } from '../../domain/template';
import { plural } from '../../ui/format';
import styles from './Builder.module.css';
import { fieldName } from './Canvas';
import type { ConfigIssues } from './configIssues';

interface IssueSummaryProps {
  issues: ConfigIssues;
  fields: readonly Field[];
  ref: RefObject<HTMLDivElement | null>;
  /** Opens the dialog that edits the title and description. */
  onShowDetails: () => void;
  onShowField: (fieldId: FieldId, issue: string) => void;
}

/**
 * Shown when Save is blocked: every problem, each a button that opens the setting to fix
 * (the GOV.UK error summary pattern). It takes focus, so the author hears why nothing saved.
 */
export function IssueSummary({
  issues,
  fields,
  ref,
  onShowDetails,
  onShowField,
}: IssueSummaryProps) {
  return (
    <div ref={ref} role="alert" tabIndex={-1} className={styles.issueSummary}>
      <h2 className={styles.issueTitle}>Fix {plural(issues.count, 'problem')} before saving</h2>
      <ul className={styles.issueList}>
        {issues.form.map((issue) => (
          <li key={issue}>
            <button type="button" className={styles.issueLink} onClick={onShowDetails}>
              <span>Title and description</span>: <span>{issue}</span>
            </button>
          </li>
        ))}
        {fields.map((field, index) =>
          (issues.fields.get(field.id) ?? []).map((issue) => (
            <li key={`${field.id}-${issue}`}>
              <button
                type="button"
                className={styles.issueLink}
                onClick={() => {
                  onShowField(field.id, issue);
                }}
              >
                <span>
                  Field {index + 1}, {fieldName(field)}
                </span>
                : <span>{issue}</span>
              </button>
            </li>
          )),
        )}
      </ul>
    </div>
  );
}
