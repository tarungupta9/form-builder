import { useMemo } from 'react';
import type { DependencyGraph } from '../../../domain/rules/graph';
import type { Field } from '../../../domain/template';
import { type TargetChoice, allowedTargets, loopHint } from './conditionTargets';

export interface ConditionTargets {
  /** The fields this field's conditions may read, with the disabled ones' reasons. */
  choices: readonly TargetChoice[];
  /** Why some targets are disabled, as visible text; `null` when none is. */
  hint: string | null;
}

/**
 * The targets a field's conditions can read, shared by its Visibility and Required sections so
 * both offer exactly the same fields and refuse the same loops (D-6).
 */
export function useConditionTargets(
  field: Field,
  fields: readonly Field[],
  graph: DependencyGraph,
): ConditionTargets {
  return useMemo(() => {
    const choices = allowedTargets(fields, graph, field.id);
    return { choices, hint: loopHint(choices) };
  }, [fields, graph, field.id]);
}
