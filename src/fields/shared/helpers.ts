/** Min / max pairs that would make every answer invalid. */
export function rangeIssue(
  min: number | undefined,
  max: number | undefined,
  what: string,
): string[] {
  return min !== undefined && max !== undefined && min > max
    ? [`The minimum ${what} is more than the maximum.`]
    : [];
}
