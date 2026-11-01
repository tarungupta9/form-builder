import { newFieldId } from '../../domain/ids';
import type { DateConfig } from '../../domain/template';
import { date, dateField, isoDate, text } from '../../test/fixtures';
import { dateDefinition } from './definition';

const longDate = (year: number, month: number, day: number) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(year, month - 1, day));

const today = isoDate('2026-11-01');

describe('Date definition', () => {
  it('creates an optional field with no prefill that passes its own schema', () => {
    const field = dateDefinition.create(newFieldId());

    expect(field.config.prefillToday).toBe(false);
    expect(dateDefinition.schema.safeParse(field).success).toBe(true);
  });

  it('rejects a stored field whose earliest date is not a calendar day', () => {
    const field = { ...dateField(), config: { prefillToday: false, minDate: '2026-02-30' } };
    expect(dateDefinition.schema.safeParse(field).success).toBe(false);
  });

  describe('settings', () => {
    const issues = (config: Partial<DateConfig>) =>
      dateDefinition.validateConfig(dateField('Travel', config), { fields: [] });

    it('blocks Save when the earliest date is after the latest', () => {
      expect(issues({ minDate: isoDate('2026-11-02'), maxDate: isoDate('2026-11-01') })).toEqual([
        'The earliest date is after the latest date.',
      ]);
    });

    it('allows the same earliest and latest date: one permitted day', () => {
      expect(issues({ minDate: today, maxDate: today })).toEqual([]);
    });
  });

  describe('pre-fill', () => {
    it("starts with today's date when pre-fill is on, and empty when it is off", () => {
      expect(
        dateDefinition.initialValue(dateField('Travel', { prefillToday: true }), today),
      ).toEqual(date('2026-11-01'));
      expect(dateDefinition.initialValue(dateField('Travel'), today)).toBeUndefined();
    });

    it('starts empty when today is outside the allowed dates, rather than with an invalid answer', () => {
      const future = dateField('Travel', { prefillToday: true, minDate: isoDate('2026-11-02') });
      const past = dateField('Travel', { prefillToday: true, maxDate: isoDate('2026-10-31') });
      const onTheLimit = dateField('Travel', {
        prefillToday: true,
        minDate: today,
        maxDate: today,
      });

      expect(dateDefinition.initialValue(future, today)).toBeUndefined();
      expect(dateDefinition.initialValue(past, today)).toBeUndefined();
      expect(dateDefinition.initialValue(onTheLimit, today)).toEqual(date('2026-11-01'));
    });
  });

  describe('answers', () => {
    const november = dateField('Travel', {
      minDate: isoDate('2026-11-01'),
      maxDate: isoDate('2026-11-30'),
    });

    it('asks for a date when required and empty, and accepts empty when optional', () => {
      expect(dateDefinition.validateValue(november, undefined, true)).toBe(
        'Enter a date for Travel',
      );
      expect(dateDefinition.validateValue(november, { kind: 'date', value: null }, true)).toBe(
        'Enter a date for Travel',
      );
      expect(dateDefinition.validateValue(november, undefined, false)).toBeNull();
    });

    it('accepts both limits and rejects the day either side, naming the limit', () => {
      expect(dateDefinition.validateValue(november, date('2026-11-01'), false)).toBeNull();
      expect(dateDefinition.validateValue(november, date('2026-11-30'), false)).toBeNull();
      expect(dateDefinition.validateValue(november, date('2026-10-31'), false)).toBe(
        `Travel must be on or after ${longDate(2026, 11, 1)}`,
      );
      expect(dateDefinition.validateValue(november, date('2026-12-01'), false)).toBe(
        `Travel must be on or before ${longDate(2026, 11, 30)}`,
      );
    });

    it('reads a date value and refuses another kind', () => {
      expect(dateDefinition.readValue(november, date('2026-11-05'))).toEqual(date('2026-11-05'));
      expect(dateDefinition.readValue(november, text('2026-11-05'))).toBeUndefined();
    });
  });

  describe('export', () => {
    it('shows the date in the long local format, on the stored calendar day', () => {
      expect(dateDefinition.toExport(dateField('Travel'), date('2026-11-01'))).toEqual({
        kind: 'answer',
        label: 'Travel',
        value: { kind: 'text', text: longDate(2026, 11, 1) },
      });
    });

    it('shows the stored day west of UTC, where parsing it as UTC would give the day before', () => {
      vi.stubEnv('TZ', 'America/Los_Angeles');
      try {
        expect(dateDefinition.toExport(dateField('Travel'), date('2026-11-01'))).toMatchObject({
          value: { text: longDate(2026, 11, 1) },
        });
        expect(longDate(2026, 11, 1)).not.toBe(
          new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date('2026-11-01')),
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('exports no date as not answered', () => {
      expect(dateDefinition.toExport(dateField('Travel'), { kind: 'date', value: null })).toEqual({
        kind: 'answer',
        label: 'Travel',
        value: { kind: 'empty' },
      });
    });
  });
});
