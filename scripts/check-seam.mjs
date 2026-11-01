#!/usr/bin/env node
/**
 * The extensibility check for field-type slices: `npm run check:seam -- v0.3`.
 *
 * Lists every source file changed since the given tag (committed, staged, unstaged or new) and
 * fails if any lies outside what adding a field type may touch. A failure is a seam leak:
 * shared Builder, Fill or export code had to learn about the new type (ground rule 4 in
 * docs/implementation-plan.md). The output is the evidence for the reviewer either way.
 *
 * Only `src/` is checked; docs, config and lockfiles are not part of the seam.
 */
import { execFileSync } from 'node:child_process';

const ALLOWED = [
  { pattern: /^src\/fields\/[^/]+\//, why: 'a plugin folder, or the shared field helpers' },
  { pattern: /^src\/fields\/(registry|ui-registry)\.ts$/, why: 'a registry line' },
  { pattern: /^src\/domain\/template\.ts$/, why: 'the FieldTypeMap entry (check the diff)' },
  { pattern: /^src\/test\/fixtures\.ts$/, why: 'test fixtures' },
  { pattern: /^src\/test\/flows\//, why: 'the slice’s demo-flow test' },
];

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: npm run check:seam -- <tag>   (for example v0.3)');
  process.exit(2);
}
try {
  git('rev-parse', '--verify', '--quiet', `${tag}^{commit}`);
} catch {
  console.error(`Unknown tag or commit: ${tag}`);
  process.exit(2);
}

const changed = [
  ...new Set([
    ...git('diff', '--name-only', tag, '--', 'src'),
    ...git('ls-files', '--others', '--exclude-standard', '--', 'src'),
  ]),
].sort();

const allowed = [];
const leaks = [];
for (const path of changed) {
  const rule = ALLOWED.find(({ pattern }) => pattern.test(path));
  if (rule) allowed.push(`  ok    ${path}  (${rule.why})`);
  else leaks.push(`  LEAK  ${path}`);
}

console.log(`Source files changed since ${tag}: ${changed.length}`);
if (allowed.length) console.log(allowed.join('\n'));
if (leaks.length) {
  console.log(leaks.join('\n'));
  console.error(
    `\n${leaks.length} file(s) outside the field-plugin seam changed. Adding a field type should not need them.`,
  );
  process.exit(1);
}
console.log('\nNo seam leaks: only plugin folders, registries, FieldTypeMap and fixtures changed.');
