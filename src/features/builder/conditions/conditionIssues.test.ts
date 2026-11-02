import { buildDependencyGraph } from '../../../domain/rules/graph';
import type { Field, Predicate } from '../../../domain/template';
import {
  condition,
  dateField,
  group,
  multiSelectField,
  numberField,
  sectionField,
  singleSelectField,
  textField,
} from '../../../test/fixtures';
import { conditionControlId } from './conditionGroups';
import { conditionIssues } from './conditionIssues';

const issuesOf = (owner: Field, fields: Field[]) =>
  conditionIssues(owner, fields, buildDependencyGraph(fields));
const messagesOf = (owner: Field, fields: Field[]) =>
  issuesOf(owner, fields).map((issue) => issue.message);

/** A Note whose show group holds one condition on `target`. */
function noteReading(target: Field, predicate: Predicate) {
  const note = textField('Note');
  note.logic.show = group('all', condition(target.id, predicate));
  return note;
}

describe('conditionIssues', () => {
  it('finds nothing to fix in finished conditions', () => {
    const nights = numberField('Nights');
    const note = noteReading(nights, { kind: 'number', op: 'between', value: { min: 2, max: 2 } });

    expect(issuesOf(note, [nights, note])).toEqual([]);
  });

  it.each<[string, Field, Predicate, string]>([
    [
      'text',
      textField('Name'),
      { kind: 'text', op: 'equals', value: '  ' },
      'enter the text to compare with',
    ],
    ['number', numberField('Nights'), { kind: 'number', op: 'gt', value: null }, 'enter a number'],
    [
      'range',
      numberField('Nights'),
      { kind: 'number', op: 'between', value: { min: 1, max: null } },
      'enter both numbers',
    ],
    [
      'choice',
      singleSelectField('Type'),
      { kind: 'choice', op: 'equals', value: null },
      'choose an option',
    ],
    [
      'multi',
      multiSelectField('Types'),
      { kind: 'multi', op: 'containsAny', value: [] },
      'choose at least one option',
    ],
    ['date', dateField('Departure'), { kind: 'date', op: 'before', value: null }, 'choose a date'],
  ])(
    'asks for the missing value of an unfinished %s condition',
    (_kind, target, predicate, detail) => {
      const note = noteReading(target, predicate);

      expect(messagesOf(note, [target, note])).toEqual([`Show condition 1: ${detail}.`]);
    },
  );

  it('flags a range whose first number is more than its second (D-8)', () => {
    const nights = numberField('Nights');
    const note = noteReading(nights, { kind: 'number', op: 'between', value: { min: 5, max: 2 } });

    const [issue] = issuesOf(note, [nights, note]);

    expect(issue?.message).toBe('Show condition 1: the first number is more than the second.');
    expect(issue?.controlId).toBe(conditionControlId(note.logic.show.conditions[0]!.id, 'min'));
  });

  it('flags a condition whose field was removed, and points at its field select', () => {
    const gone = numberField('Nights');
    const note = noteReading(gone, { kind: 'number', op: 'gt', value: 3 });

    const [issue] = issuesOf(note, [note]);

    expect(issue?.message).toBe('Show condition 1: the field it reads was removed.');
    expect(issue?.controlId).toBe(conditionControlId(note.logic.show.conditions[0]!.id, 'target'));
  });

  it('flags a choice condition whose option was removed, instead of letting it always hold', () => {
    const type = singleSelectField('Type');
    const removed = type.config.options[2]!;
    const note = noteReading(type, { kind: 'choice', op: 'notEquals', value: removed.id });
    type.config.options = type.config.options.slice(0, 2);

    expect(messagesOf(note, [type, note])).toEqual([
      'Show condition 1: an option it compares against was removed.',
    ]);
  });

  it('flags a multi condition with any removed option', () => {
    const types = multiSelectField('Types');
    const [kept, removed] = types.config.options;
    const note = noteReading(types, {
      kind: 'multi',
      op: 'containsAll',
      value: [kept!.id, removed!.id],
    });
    types.config.options = types.config.options.filter((option) => option !== removed);

    expect(messagesOf(note, [types, note])).toEqual([
      'Show condition 1: an option it compares against was removed.',
    ]);
  });

  it('flags a condition on a field that cannot be read, or read another way, as in hand-edited data (D6-13)', () => {
    const heading = sectionField('Trip details');
    const name = textField('Name');
    const note = textField('Note');
    note.logic.hide = group(
      'any',
      condition(heading.id, { kind: 'text', op: 'equals', value: 'x' }),
      condition(name.id, { kind: 'number', op: 'gt', value: 3 }),
    );

    expect(messagesOf(note, [heading, name, note])).toEqual([
      'Hide condition 1: the field it reads can’t be used in conditions.',
      'Hide condition 2: the field it reads can’t be used in conditions.',
    ]);
  });

  it('flags both sides of a loop found in stored data, but not a field downstream of it (D-6, D6-13)', () => {
    const a = textField('A');
    const b = textField('B');
    const c = textField('C');
    a.logic.hide = group('all', condition(b.id, { kind: 'text', op: 'equals', value: 'x' }));
    b.logic.hide = group('all', condition(a.id, { kind: 'text', op: 'equals', value: 'x' }));
    c.logic.hide = group('all', condition(b.id, { kind: 'text', op: 'equals', value: 'x' }));
    const fields = [a, b, c];

    expect(messagesOf(a, fields)).toEqual([
      'Hide condition 1: it makes a loop, because B already depends on this field.',
    ]);
    expect(messagesOf(b, fields)).toHaveLength(1);
    expect(messagesOf(c, fields)).toEqual([]);
  });

  it('numbers conditions within their own group, show before hide', () => {
    const nights = numberField('Nights');
    const note = textField('Note');
    const unfinished: Predicate = { kind: 'number', op: 'gt', value: null };
    note.logic.show = group('all', condition(nights.id, { kind: 'number', op: 'gt', value: 1 }));
    note.logic.hide = group(
      'all',
      condition(nights.id, unfinished),
      condition(nights.id, unfinished),
    );

    expect(messagesOf(note, [nights, note])).toEqual([
      'Hide condition 1: enter a number.',
      'Hide condition 2: enter a number.',
    ]);
  });

  it('flags an unfinished required condition, numbered within its own group', () => {
    const nights = numberField('Nights');
    const note = textField('Note');
    note.logic.require = group(
      'all',
      condition(nights.id, { kind: 'number', op: 'gt', value: 50 }),
      condition(nights.id, { kind: 'number', op: 'gt', value: null }),
    );

    const [issue] = issuesOf(note, [nights, note]);

    expect(issue?.message).toBe('Required condition 2: enter a number.');
    expect(issue?.controlId).toBe(
      conditionControlId(note.logic.require.conditions[1]!.id, 'value'),
    );
  });

  it('numbers conditions show, hide, required, then not-required', () => {
    const nights = numberField('Nights');
    const note = textField('Note');
    const unfinished = () => condition(nights.id, { kind: 'number', op: 'gt', value: null });
    note.logic.unrequire = group('all', unfinished());
    note.logic.require = group('all', unfinished());
    note.logic.hide = group('all', unfinished());
    note.logic.show = group('all', unfinished());

    expect(messagesOf(note, [nights, note])).toEqual([
      'Show condition 1: enter a number.',
      'Hide condition 1: enter a number.',
      'Required condition 1: enter a number.',
      'Not-required condition 1: enter a number.',
    ]);
  });
});
