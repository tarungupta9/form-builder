import { newOptionId } from '../../domain/ids';
import type { Option } from '../../domain/template';

/** Single and multi select compare labels the same way, so "Yes" and " yes " are one label. */
const labelKey = (label: string): string => label.trim().toLocaleLowerCase();

/** The two options a new single or multi select starts with. */
export const starterOptions = (): Option[] => [
  { id: newOptionId(), label: 'Option 1' },
  { id: newOptionId(), label: 'Option 2' },
];

/**
 * The label for an option the author adds: "Option N", with N one past the count and then the
 * first number no other option uses. Counting alone would repeat a label after a removal
 * ("Option 1" removed, then a second "Option 2" added), which trips the uniqueness rule at once.
 */
export function nextOptionLabel(options: readonly Option[]): string {
  const taken = new Set(options.map((option) => labelKey(option.label)));
  let n = options.length + 1;
  while (taken.has(labelKey(`Option ${n}`))) n += 1;
  return `Option ${n}`;
}

/**
 * Option lists that block Save. One option is enough ("I confirm"). Empty and duplicate labels
 * are not: they would make the PDF and, later, the condition picker ambiguous.
 */
export function optionListIssues(options: readonly Option[]): string[] {
  const issues: string[] = [];
  if (options.length === 0) issues.push('Add at least one option.');
  if (options.some((option) => option.label.trim() === ''))
    issues.push('Give every option a label.');
  const labels = options.map((option) => labelKey(option.label)).filter(Boolean);
  if (new Set(labels).size !== labels.length)
    issues.push('Option labels must be different from each other.');
  return issues;
}
