import {
  condition,
  group,
  num,
  submittedResponse,
  template,
  text,
  textField,
} from '../test/fixtures';
import { QUARANTINE_PREFIX } from './collection';
import { STORAGE_KEYS, createRepositories } from './repositories';

const repositories = () => createRepositories(localStorage);

describe('template storage', () => {
  it('round-trips a template through localStorage, as after a full page refresh', () => {
    const name = textField('Name', {
      config: { placeholder: 'Jo', maxLength: 40, prefix: '', suffix: '' },
    });
    const note = textField('Note');
    note.logic.show = group('any', condition(name.id, { kind: 'text', op: 'equals', value: 'x' }));
    const saved = template([name, note]);

    expect(repositories().templates.put(saved).ok).toBe(true);

    // A fresh repository has no cache, so this reads and parses what was written.
    const reread = repositories().templates.snapshot();
    expect(reread.ok && reread.value.get(saved.id)).toEqual(saved);
  });

  it('starts empty when nothing has been saved yet', () => {
    const snapshot = repositories().templates.snapshot();
    expect(snapshot.ok && snapshot.value.size).toBe(0);
  });

  it('quarantines unreadable data instead of wiping it, and refuses to write over it', () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{not json');
    const repos = repositories();

    const snapshot = repos.templates.snapshot();
    expect(snapshot.ok).toBe(false);
    if (!snapshot.ok) expect(snapshot.error.kind).toBe('corrupt');

    const backups = Object.keys(localStorage).filter((key) => key.startsWith(QUARANTINE_PREFIX));
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0]!)).toBe('{not json');

    expect(repos.templates.put(template([])).ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe('{not json');
  });

  it('rejects a template whose field has a condition on itself', () => {
    const name = textField('Name');
    name.logic.hide = group('all', condition(name.id, { kind: 'text', op: 'equals', value: 'x' }));
    const bad = template([name]);
    localStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify({ schemaVersion: 1, items: { [bad.id]: bad } }),
    );

    const snapshot = repositories().templates.snapshot();
    expect(snapshot.ok).toBe(false);
  });

  it('leaves data from a newer app version untouched', () => {
    const raw = JSON.stringify({ schemaVersion: 99, items: {} });
    localStorage.setItem(STORAGE_KEYS.templates, raw);
    const repos = repositories();

    const snapshot = repos.templates.snapshot();
    expect(!snapshot.ok && snapshot.error.kind).toBe('newerVersion');
    expect(repos.templates.put(template([])).ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe(raw);
  });

  it('reports a full storage quota without losing what is already stored', () => {
    const repos = repositories();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const result = repos.templates.put(template([]));
    expect(!result.ok && result.error.kind).toBe('quota');
  });

  it('returns the same snapshot until something changes, as useSyncExternalStore requires', () => {
    const repos = repositories();
    const first = repos.templates.snapshot();
    expect(repos.templates.snapshot()).toBe(first);
    repos.templates.put(template([]));
    expect(repos.templates.snapshot()).not.toBe(first);
  });

  it('notifies subscribers when another tab changes the key', () => {
    const repos = repositories();
    const listener = vi.fn();
    repos.templates.subscribe(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.templates }));
    expect(listener).toHaveBeenCalled();
  });
});

describe('response storage', () => {
  it('round-trips a submitted response with its snapshot', () => {
    const name = textField('Name');
    const saved = submittedResponse(template([name]), { [name.id]: text('Ada') });

    expect(repositories().responses.put(saved).ok).toBe(true);

    const reread = repositories().responses.snapshot();
    expect(reread.ok && reread.value.get(saved.id)).toEqual(saved);
  });

  it.each([
    ['of the wrong kind for its field', (fieldId: string) => ({ [fieldId]: num('5') })],
    ['for a field missing from the snapshot', () => ({ [textField('Gone').id]: text('x') })],
  ])('rejects a stored response with an answer %s', (_case, answersFor) => {
    const name = textField('Name');
    const bad = submittedResponse(template([name]));
    localStorage.setItem(
      STORAGE_KEYS.responses,
      JSON.stringify({
        schemaVersion: 1,
        items: { [bad.id]: { ...bad, answers: answersFor(name.id) } },
      }),
    );

    expect(repositories().responses.snapshot().ok).toBe(false);
  });
});
