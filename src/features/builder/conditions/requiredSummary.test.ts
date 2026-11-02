import type { InputFieldLogic } from '../../../domain/template';
import { condition, group, numberField } from '../../../test/fixtures';
import { requiredSummary } from './requiredSummary';

const amount = numberField('Amount');
const some = (match: 'all' | 'any') =>
  group(match, condition(amount.id, { kind: 'number', op: 'gt', value: 50 }));

function logic(change: Partial<InputFieldLogic>): InputFieldLogic {
  return { ...numberField('Receipt').logic, ...change };
}

describe('requiredSummary', () => {
  it.each<[string, Partial<InputFieldLogic>, string]>([
    ['off with no conditions', {}, 'Optional.'],
    ['off, ignoring not-required conditions', { unrequire: some('all') }, 'Optional.'],
    [
      'off with required conditions',
      { require: some('all'), unrequire: some('any') },
      'Optional, and required when all of its required conditions match.',
    ],
    [
      'off with "any" required conditions',
      { require: some('any') },
      'Optional, and required when any of its required conditions match.',
    ],
    ['on with no conditions', { defaultRequired: true }, 'Required.'],
    [
      'on, ignoring required conditions alone',
      { defaultRequired: true, require: some('all') },
      'Required.',
    ],
    [
      'on with not-required conditions',
      { defaultRequired: true, unrequire: some('any') },
      'Required, unless any of its not-required conditions match.',
    ],
    [
      'on with both',
      { defaultRequired: true, require: some('all'), unrequire: some('all') },
      'Required, unless all of its not-required conditions match. Required conditions win when both match.',
    ],
  ])('reads the switch and groups as one sentence: %s', (_case, change, sentence) => {
    expect(requiredSummary(logic(change))).toBe(sentence);
  });
});
