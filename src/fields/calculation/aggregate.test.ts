import { aggregate, roundTo } from './aggregate';

describe('aggregate', () => {
  it.each([
    ['sum', 60],
    ['average', 20],
    ['min', 10],
    ['max', 30],
  ] as const)('computes the %s of the filled sources', (aggregation, expected) => {
    expect(aggregate([10, 20, 30], aggregation, 2)).toBe(expected);
  });

  it('is empty when no source is filled', () => {
    expect(aggregate([], 'sum', 2)).toBeNull();
    expect(aggregate([], 'average', 2)).toBeNull();
  });

  it('rounds the result to the configured decimals', () => {
    expect(aggregate([1, 2], 'average', 0)).toBe(2);
    expect(aggregate([10, 10, 11], 'average', 2)).toBe(10.33);
  });

  it('adds money without floating-point noise', () => {
    expect(aggregate([0.1, 0.2], 'sum', 2)).toBe(0.3);
  });
});

describe('roundTo', () => {
  it('rounds halves away from zero', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.5, 0)).toBe(-3);
  });

  it('never returns negative zero', () => {
    expect(Object.is(roundTo(-0.001, 2), 0)).toBe(true);
  });
});
