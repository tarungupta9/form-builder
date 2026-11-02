/**
 * What the rules engine needs to know about fields whose value is computed rather than typed
 * (a calculation, from v0.9), without naming any field type (ADR 0018).
 *
 * The domain layer cannot import the plugin registry, so the registry hands the engine this
 * interface (`fieldDerivations` in `fields/registry.ts`), built from each plugin's optional
 * `derivation` member. A field type that derives nothing simply has no such member.
 */
import type { FieldId } from '../ids';
import type { FieldValue, ResponseValues } from '../response';
import type { Field } from '../template';

export interface FieldDerivations {
  /**
   * The fields `field`'s value is computed from. They are edges in the dependency graph, like
   * condition targets, so the engine computes the field after them and the builder lists it as
   * a dependant when one of them is removed (D-12). Empty for a field the respondent answers.
   */
  sourcesOf(field: Field): readonly FieldId[];
  /** The field with `sourceId` dropped from its sources; the same object when it has none. */
  withoutSource(field: Field, sourceId: FieldId): Field;
  /**
   * The computed value, from the effective values of its sources, so a hidden source never
   * counts (D-9). `null` means the field is not derived; `{ value: undefined }` means it is,
   * and the result is empty (D-14).
   */
  derive(field: Field, effective: ResponseValues): { value: FieldValue | undefined } | null;
}

/**
 * For rule tests whose fields derive nothing. Production code passes `fieldDerivations`, so
 * calculations take part; see the flow tests for the wiring.
 */
export const NO_DERIVED_FIELDS: FieldDerivations = {
  sourcesOf: () => [],
  withoutSource: (field) => field,
  derive: () => null,
};
