/** Ends an exhaustive switch: adding a union member turns every unhandled switch into a compile error. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
