import { type RefObject } from 'react';
import type { FieldId } from '../../domain/ids';
import type { Field } from '../../domain/template';
import { ErrorSummary, type ErrorSummaryItem } from '../../ui/ErrorSummary';
import { plural } from '../../ui/format';
import { fieldName } from './Canvas';
import type { ConfigIssue, ConfigIssues } from './configIssues';

interface IssueSummaryProps {
  issues: ConfigIssues;
  fields: readonly Field[];
  ref: RefObject<HTMLDivElement | null>;
  /** Opens the dialog that edits the title and description. */
  onShowDetails: () => void;
  onShowField: (fieldId: FieldId, issue: ConfigIssue) => void;
}

/** Shown when Save is blocked: every problem, each one opening the setting to fix. */
export function IssueSummary({
  issues,
  fields,
  ref,
  onShowDetails,
  onShowField,
}: IssueSummaryProps) {
  const items: ErrorSummaryItem[] = [
    ...issues.form.map((issue) => ({
      key: issue,
      label: (
        <>
          <span>Title and description</span>: <span>{issue}</span>
        </>
      ),
      onSelect: onShowDetails,
    })),
    ...fields.flatMap((field, index) =>
      (issues.fields.get(field.id) ?? []).map((issue) => ({
        key: `${field.id}-${issue.controlId ?? ''}-${issue.message}`,
        label: (
          <>
            <span>
              Field {index + 1}, {fieldName(field)}
            </span>
            : <span>{issue.message}</span>
          </>
        ),
        onSelect: () => {
          onShowField(field.id, issue);
        },
      })),
    ),
  ];
  return (
    <ErrorSummary
      ref={ref}
      title={`Fix ${plural(issues.count, 'problem')} before saving`}
      items={items}
    />
  );
}
