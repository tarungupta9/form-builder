import type { FieldId } from '../ids';
import type { ResponseValues } from '../response';
import { type ConditionGroup, type Field, type FieldLogic, hasRequiredAxis } from '../template';
import { type FieldDerivations, NO_DERIVED_FIELDS } from './derivations';
import { type DependencyGraph, buildDependencyGraph } from './graph';
import { predicateHolds } from './predicates';

export interface FormEvaluation {
  visible: ReadonlySet<FieldId>;
  /** Only ever visible fields: a hidden field is never required, whatever its settings. */
  required: ReadonlySet<FieldId>;
  /**
   * The values conditions see, and the only ones that may be submitted: hidden fields are
   * absent (D-5, D-9), and each visible derived field holds its computed value (ADR 0018).
   */
  effective: ResponseValues;
}

/**
 * Resolves visibility and required state for the whole form in one pass, in dependency order,
 * so chained conditions (A → B → C) settle without iteration (D-5).
 *
 * Raw `values` keep what the user typed into fields that are now hidden, so un-hiding a field
 * restores it; only `effective` drops them (D-9).
 *
 * A derived field is computed in the same pass: its sources come before it in dependency
 * order, so it reads their effective values, and a hidden source is already absent (D-14).
 * Pass the same `derivations` the graph was built with.
 */
export function evaluateForm(
  fields: readonly Field[],
  values: ResponseValues,
  derivations: FieldDerivations = NO_DERIVED_FIELDS,
  graph: DependencyGraph = buildDependencyGraph(fields, derivations),
): FormEvaluation {
  const byId = new Map(fields.map((field) => [field.id, field]));
  const visible = new Set<FieldId>();
  const required = new Set<FieldId>();
  const effective: ResponseValues = {};

  const isActive = (group: ConditionGroup): boolean => {
    if (group.conditions.length === 0) return false;
    const holds = group.conditions.map((condition) =>
      predicateHolds(condition.predicate, effective[condition.targetFieldId]),
    );
    return group.match === 'all' ? holds.every(Boolean) : holds.some(Boolean);
  };

  const resolve = (field: Field, useConditions: boolean): void => {
    const logic: FieldLogic = field.logic;
    const isVisible = useConditions ? resolveVisible(logic, isActive) : logic.defaultVisible;
    if (!isVisible) return;
    visible.add(field.id);

    if (hasRequiredAxis(logic)) {
      // Require beats not-require when both groups are active: when unsure, ask (D-2).
      const isRequired = useConditions
        ? isActive(logic.require) || (logic.defaultRequired && !isActive(logic.unrequire))
        : logic.defaultRequired;
      if (isRequired) required.add(field.id);
    }

    const derived = derivations.derive(field, effective);
    const value = derived ? derived.value : values[field.id];
    if (value !== undefined) effective[field.id] = value;
  };

  for (const id of graph.order) {
    const field = byId.get(id);
    if (field) resolve(field, true);
  }
  // Defensive only: from v0.6 the builder refuses conditions that would form a cycle (D-6). A field that
  // still ends up in one has no well-defined state, so it falls back to its defaults.
  for (const field of fields) {
    if (graph.cyclic.has(field.id)) resolve(field, false);
  }

  return { visible, required, effective };
}

/** Hide beats show when both groups are active: when the rules are ambiguous, collect less (D-2). */
function resolveVisible(logic: FieldLogic, isActive: (group: ConditionGroup) => boolean): boolean {
  if (isActive(logic.hide)) return false;
  return logic.defaultVisible || isActive(logic.show);
}
