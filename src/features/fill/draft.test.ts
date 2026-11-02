import { newFieldId, newResponseId, toIsoDateTime } from '../../domain/ids';
import {
  choice,
  multi,
  multiSelectField,
  singleSelectField,
  template,
  text,
  textField,
} from '../../test/fixtures';
import { restoreValues, templateChangedSince, toDraft } from './draft';

describe('restoreValues (a draft resumed against the current template)', () => {
  it('keeps every answer that still fits its field', () => {
    const name = textField('Name');
    const method = singleSelectField('Method');
    const card = method.config.options[0]!;

    const restored = restoreValues([name, method], {
      [name.id]: text('Ada'),
      [method.id]: choice(card.id),
    });

    expect(restored).toEqual({ [name.id]: text('Ada'), [method.id]: choice(card.id) });
  });

  it('treats an answer whose field was deleted as empty', () => {
    const name = textField('Name');

    expect(restoreValues([name], { [newFieldId()]: text('Orphan') })).toEqual({});
  });

  it('treats a single-select answer whose option was deleted as empty', () => {
    const method = singleSelectField('Method');
    const deleted = method.config.options[0]!;
    const current = {
      ...method,
      config: { ...method.config, options: method.config.options.slice(1) },
    };

    expect(restoreValues([current], { [method.id]: choice(deleted.id) })).toEqual({});
  });

  it('drops only the deleted options from a multi-select answer', () => {
    const types = multiSelectField('Types');
    const [travel, meals] = types.config.options;
    const current = { ...types, config: { ...types.config, options: [meals!] } };

    expect(restoreValues([current], { [types.id]: multi(travel!.id, meals!.id) })).toEqual({
      [types.id]: multi(meals!.id),
    });
  });

  it('treats an answer of the wrong kind, as after a field’s type changed, as empty', () => {
    const method = singleSelectField('Method');

    expect(restoreValues([method], { [method.id]: text('Card') })).toEqual({});
  });
});

describe('templateChangedSince', () => {
  const form = template([textField('Name')]);
  const draftAgainst = (updatedAt: string) =>
    toDraft(
      { ...form, updatedAt: toIsoDateTime(new Date(updatedAt)) },
      {},
      {
        id: newResponseId(),
        startedAt: form.createdAt,
        savedAt: form.createdAt,
      },
    );

  it('is false while the template is the one the draft was saved against', () => {
    expect(templateChangedSince(draftAgainst(form.updatedAt), form)).toBe(false);
  });

  it('is true once the template has been saved since', () => {
    expect(templateChangedSince(draftAgainst('2026-10-01T00:00:00Z'), form)).toBe(true);
  });
});
