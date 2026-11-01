/**
 * Upgrades stored envelopes to the current shape before they are validated.
 *
 * Version 1 is the first shape, so there is nothing to upgrade yet. When the shape changes,
 * bump `CURRENT_SCHEMA_VERSION` and add a step to `STEPS` that turns version N into N + 1;
 * `migrate` runs every step from the stored version upwards. Data from a newer version is left
 * untouched, because this version cannot know what it would lose by rewriting it.
 */
export const CURRENT_SCHEMA_VERSION = 1;

type Step = (envelope: Record<string, unknown>) => Record<string, unknown>;

/** `STEPS[n]` upgrades version `n` to `n + 1`. */
const STEPS: Partial<Record<number, Step>> = {};

export type MigrationResult =
  | { status: 'ok'; envelope: Record<string, unknown> }
  | { status: 'newer'; version: number }
  | { status: 'invalid' };

export function migrate(raw: unknown): MigrationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { status: 'invalid' };
  const envelope = raw as Record<string, unknown>;
  const version = envelope.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    return { status: 'invalid' };
  if (version > CURRENT_SCHEMA_VERSION) return { status: 'newer', version };

  let current = envelope;
  for (let from = version; from < CURRENT_SCHEMA_VERSION; from += 1) {
    const step = STEPS[from];
    if (!step) return { status: 'invalid' };
    current = step(current);
  }
  return { status: 'ok', envelope: current };
}
