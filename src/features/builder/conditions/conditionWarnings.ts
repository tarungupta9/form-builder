/**
 * Things worth telling the author about a field's conditions that never block Save: a group
 * that cannot change anything (D-3), two groups that pull against each other (D-2), and a field
 * no respondent will ever see. Their own channel, apart from the Save issues in `configIssues`,
 * so a warning can never be counted as a problem.
 *
 * Each rule is structural: it reads the defaults and which groups have conditions, never the
 * conditions' values, so it says "if both match" and makes no claim that both can.
 *
 * The rules follow the engine (`evaluate.ts`), which is stricter than "a group equal to the
 * default has no effect": Show on a visible field and Not required on an optional one never
 * matter, but Hide on a hidden field and Require on a required one matter as soon as the
 * opposite group has conditions, because they then override it.
 */
import { type Effect, type Field, hasRequiredAxis } from '../../../domain/template';

export type WarningCode = 'noOp' | 'opposing' | 'neverShown';

export interface ConditionWarning {
  code: WarningCode;
  /** The group it is about, shown under that group; `null` for the field's visibility as a whole. */
  effect: Effect | null;
  message: string;
}

export const ALREADY_VISIBLE_HINT =
  'This field is already visible, so these conditions only matter if it starts hidden.';

const has = (group: { conditions: readonly unknown[] }): boolean => group.conditions.length > 0;

export function conditionWarnings(field: Field): ConditionWarning[] {
  const { logic } = field;
  const warnings: ConditionWarning[] = [];

  if (logic.defaultVisible) {
    if (has(logic.show)) {
      warnings.push({ code: 'noOp', effect: 'show', message: ALREADY_VISIBLE_HINT });
    }
  } else if (!has(logic.show)) {
    warnings.push({
      code: 'neverShown',
      effect: null,
      message: 'This field starts hidden and nothing shows it, so respondents never see it.',
    });
    if (has(logic.hide)) {
      warnings.push({
        code: 'noOp',
        effect: 'hide',
        message:
          'This field already starts hidden and nothing shows it, so these conditions change nothing.',
      });
    }
  } else if (has(logic.hide)) {
    warnings.push({
      code: 'opposing',
      effect: 'hide',
      message: 'If Show and Hide both match, the field stays hidden.',
    });
  }

  if (!hasRequiredAxis(logic)) return warnings;

  if (!logic.defaultRequired) {
    if (has(logic.unrequire)) {
      warnings.push({
        code: 'noOp',
        effect: 'unrequire',
        message:
          'This field is already optional, so these conditions only matter if Required is on.',
      });
    }
  } else if (has(logic.require)) {
    warnings.push(
      has(logic.unrequire)
        ? {
            code: 'opposing',
            effect: 'require',
            message: 'If both match, the field is required: Mark as required wins.',
          }
        : {
            code: 'noOp',
            effect: 'require',
            message:
              'This field is already required, so these conditions only matter if it is optional.',
          },
    );
  }
  return warnings;
}

const keyOf = ({ code, effect }: ConditionWarning): string => `${code}:${effect ?? 'field'}`;

/** The warnings in `after` that were not in `before`, so only a new one is announced. */
export function newWarnings(
  before: readonly ConditionWarning[],
  after: readonly ConditionWarning[],
): ConditionWarning[] {
  const seen = new Set(before.map(keyOf));
  return after.filter((warning) => !seen.has(keyOf(warning)));
}

/** The warnings shown under one group. */
export const warningsFor = (
  warnings: readonly ConditionWarning[],
  effect: Effect | null,
): string[] => warnings.filter((warning) => warning.effect === effect).map((w) => w.message);
