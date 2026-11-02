import { isoDate } from '../../test/fixtures';
import { formatIsoDate } from './format';

describe('formatIsoDate', () => {
  it('shows a year below 100 as written, not as 19xx', () => {
    // Locale-robust: the year reads as "2" (or "0002") in any locale, never "1902".
    const formatted = formatIsoDate(isoDate('0002-03-15'));
    expect(formatted).not.toContain('1902');
    expect(formatted).toMatch(/(^|\D)0*2(\D|$)/);
  });
});
