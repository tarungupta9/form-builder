import { options } from '../../test/fixtures';
import { nextOptionLabel, starterOptions } from './options';

describe('Option labels', () => {
  it('names a new option one past the count', () => {
    expect(nextOptionLabel(options('Option 1', 'Option 2'))).toBe('Option 3');
    expect(nextOptionLabel([])).toBe('Option 1');
  });

  it('never repeats a label after an option was removed', () => {
    // "Option 1" was removed, leaving "Option 2": counting alone would add a second "Option 2".
    expect(nextOptionLabel(options('Option 2'))).toBe('Option 3');
    expect(nextOptionLabel(options('option 3', 'Card'))).toBe('Option 4');
  });

  it('gives every starter option its own ID', () => {
    const [first, second] = starterOptions();
    expect(first!.id).not.toBe(second!.id);
  });
});
