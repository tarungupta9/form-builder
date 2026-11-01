import axe from 'axe-core';

/**
 * Runs axe over a rendered container and expects no violations. Colour contrast is off because
 * jsdom does no layout; contrast is checked by hand against the design tokens instead.
 * Comparing the list with `[]` prints every violation in full when the check fails.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  expect(violations).toEqual([]);
}
