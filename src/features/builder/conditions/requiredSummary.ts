import type { InputFieldLogic } from '../../../domain/template';

/**
 * The Required switch and its two groups read back as one sentence, the way the engine resolves
 * them: a group that cannot change the default is left out (the warnings say so), and when both
 * groups can apply, require wins (D-2).
 */
export function requiredSummary(logic: InputFieldLogic): string {
  const { defaultRequired, require, unrequire } = logic;
  if (!defaultRequired) {
    return require.conditions.length === 0
      ? 'Optional.'
      : `Optional, and required when ${require.match} of its required conditions match.`;
  }
  if (unrequire.conditions.length === 0) return 'Required.';
  const unless = `Required, unless ${unrequire.match} of its not-required conditions match.`;
  return require.conditions.length === 0
    ? unless
    : `${unless} Required conditions win when both match.`;
}
