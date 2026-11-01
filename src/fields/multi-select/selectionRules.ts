import type { MultiSelectConfig } from '../../domain/template';
import { plural } from '../../ui/format';

/** A minimum of 0 asks for nothing, so it reads the same as no minimum (O-16). */
export const minimumOf = (config: MultiSelectConfig): number | undefined =>
  config.minSelections === 0 ? undefined : config.minSelections;

/**
 * Selection limits that no answer could meet, one slot per setting so the editor can show each
 * beside its own box and `validateConfig` can list them. A maximum above the option count is
 * allowed: it limits nothing, and the hint still reads "up to N" (O-16).
 */
export function selectionLimitIssues(config: MultiSelectConfig): {
  min: string | null;
  max: string | null;
} {
  const min = minimumOf(config);
  const max = config.maxSelections;
  const count = config.options.length;
  return {
    min:
      min !== undefined && max !== undefined && min > max
        ? 'The minimum number of choices is more than the maximum.'
        : min !== undefined && min > count
          ? `The minimum number of choices is more than the ${plural(count, 'option')} available.`
          : null,
    max: max === 0 ? 'The maximum number of choices must be at least 1.' : null,
  };
}

/** The limits as a hint under the legend, so the respondent knows them before submitting. */
export function selectionHint(config: MultiSelectConfig): string | null {
  const min = minimumOf(config);
  const max = config.maxSelections;
  if (min !== undefined && max !== undefined)
    return min === max
      ? `Choose ${plural(min, 'option')}.`
      : `Choose between ${min} and ${plural(max, 'option')}.`;
  if (min !== undefined) return `Choose at least ${plural(min, 'option')}.`;
  if (max !== undefined) return `Choose up to ${plural(max, 'option')}.`;
  return null;
}
