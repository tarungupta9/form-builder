import { rangeIssue } from './helpers';

interface LengthLimits {
  minLength?: number;
  maxLength?: number;
}

/** Length limits that would reject every answer. Shared by Short text and Long text. */
export function lengthConfigIssues(limits: LengthLimits): string[] {
  return [
    ...rangeIssue(limits.minLength, limits.maxLength, 'length'),
    ...(limits.maxLength === 0 ? ['The maximum length must be at least 1.'] : []),
  ];
}
