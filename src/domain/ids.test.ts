import { parseIsoDate, parseTemplateId, toIsoDate } from './ids';

describe('toIsoDate', () => {
  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 local on 31 Oct is already 1 Nov in UTC for anyone west of Greenwich.
    expect(toIsoDate(new Date(2026, 9, 31, 23, 30))).toBe('2026-10-31');
    expect(toIsoDate(new Date(2026, 0, 5, 0, 15))).toBe('2026-01-05');
  });
});

describe('parseIsoDate', () => {
  it('accepts a real calendar day', () => {
    expect(parseIsoDate('2024-02-29')).toBe('2024-02-29');
  });

  it.each(['2026-02-30', '2026-13-01', '31/10/2026', '2026-10-31T00:00:00Z', ''])(
    'rejects %j',
    (raw) => {
      expect(parseIsoDate(raw)).toBeNull();
    },
  );
});

describe('parseTemplateId', () => {
  it('rejects a value that is not a UUID, such as a hand-edited URL', () => {
    expect(parseTemplateId('not-an-id')).toBeNull();
    expect(parseTemplateId('3f9a2c1e-0000-4000-8000-000000000000')).not.toBeNull();
  });
});
