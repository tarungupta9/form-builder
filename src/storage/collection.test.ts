import {
  condition,
  group,
  num,
  submittedResponse,
  template,
  text,
  textField,
} from '../test/fixtures';
import { newTemplateId } from '../domain/ids';
import type { FormTemplate } from '../domain/template';
import { QUARANTINE_PREFIX } from './collection';
import { STORAGE_KEYS, createRepositories } from './repositories';

const repositories = () => createRepositories(localStorage);

const backupKeys = () =>
  Object.keys(localStorage).filter((key) => key.startsWith(QUARANTINE_PREFIX));

/** Writes items straight to storage, as a hand edit or an older, buggy version might. */
function storeRaw(key: string, items: Record<string, unknown>) {
  const raw = JSON.stringify({ schemaVersion: 1, items });
  localStorage.setItem(key, raw);
  return raw;
}

/** A template whose field has a condition on itself, which the builder never produces. */
function selfReferencingTemplate(): FormTemplate {
  const name = textField('Name');
  name.logic.hide = group('all', condition(name.id, { kind: 'text', op: 'equals', value: 'x' }));
  return template([name], 'Broken');
}

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

  it('quarantines a key it cannot parse at all instead of wiping it, and refuses to write over it', () => {
    localStorage.setItem(STORAGE_KEYS.templates, '{not json');
    const repos = repositories();

    const snapshot = repos.templates.snapshot();
    expect(snapshot.ok).toBe(false);
    if (!snapshot.ok) expect(snapshot.error.kind).toBe('corrupt');

    expect(backupKeys()).toHaveLength(1);
    expect(localStorage.getItem(backupKeys()[0]!)).toBe('{not json');

    expect(repos.templates.put(template([])).ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe('{not json');
  });

  describe('one unreadable item among readable ones', () => {
    it('sets the invalid template aside on its own, and the valid ones still load', () => {
      const good = template([textField('Name')], 'Expense claim');
      const bad = selfReferencingTemplate();
      storeRaw(STORAGE_KEYS.templates, { [good.id]: good, [bad.id]: bad });

      const snapshot = repositories().templates.snapshot();

      expect(snapshot.ok).toBe(true);
      expect(snapshot.ok && [...snapshot.value.values()]).toEqual([good]);
    });

    it('keeps the stored data, the invalid item included, under a backup key it reports', () => {
      const good = template([], 'Good');
      const raw = storeRaw(STORAGE_KEYS.templates, { [good.id]: good, junk: { title: 42 } });
      const repos = repositories();

      repos.templates.snapshot();

      expect(backupKeys()).toHaveLength(1);
      const [backupKey] = backupKeys();
      expect(localStorage.getItem(backupKey!)).toBe(raw);
      expect(repos.templates.setAside()).toEqual([{ count: 1, backupKey }]);
    });

    it('sets aside an item stored under a key that is not its own ID', () => {
      const good = template([], 'Good');
      const misfiled = template([], 'Misfiled');
      // A fresh ID, so the wrong key can never coincide with the good item's own.
      storeRaw(STORAGE_KEYS.templates, { [good.id]: good, [newTemplateId()]: misfiled });

      const repos = repositories();
      const snapshot = repos.templates.snapshot();

      expect(snapshot.ok && [...snapshot.value.values()]).toEqual([good]);
      expect(repos.templates.setAside()[0]?.count).toBe(1);
    });

    it('sets an item aside once: after a reload only valid items remain, and no new backup is made', () => {
      const good = template([], 'Good');
      storeRaw(STORAGE_KEYS.templates, { [good.id]: good, junk: null });
      repositories().templates.snapshot();

      // A fresh repository reads storage again, as after a full page refresh.
      const reloaded = repositories().templates;
      const snapshot = reloaded.snapshot();

      expect(snapshot.ok && [...snapshot.value.values()]).toEqual([good]);
      expect(reloaded.setAside()).toEqual([]);
      expect(backupKeys()).toHaveLength(1);
    });

    it('keeps saving after setting an item aside, without bringing it back', () => {
      const good = template([], 'Good');
      storeRaw(STORAGE_KEYS.templates, { [good.id]: good, junk: null });
      const repos = repositories();
      repos.templates.snapshot();

      const added = template([], 'Added');
      expect(repos.templates.put(added).ok).toBe(true);

      const reread = repositories().templates.snapshot();
      expect(reread.ok && [...reread.value.keys()].sort()).toEqual([good.id, added.id].sort());
      expect(repos.templates.setAside()).toHaveLength(1);
    });

    it('sets nothing aside, and the whole key is reported unreadable, when no backup can be made', () => {
      const good = template([], 'Good');
      const raw = storeRaw(STORAGE_KEYS.templates, { [good.id]: good, junk: null });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError');
      });
      const repos = repositories();

      const snapshot = repos.templates.snapshot();

      expect(!snapshot.ok && snapshot.error).toEqual({
        kind: 'corrupt',
        key: STORAGE_KEYS.templates,
        backupKey: null,
      });
      expect(localStorage.getItem(STORAGE_KEYS.templates)).toBe(raw);
      expect(repos.templates.put(template([])).ok).toBe(false);
    });
  });

  it('sets aside a template whose field has a condition on itself', () => {
    const bad = selfReferencingTemplate();
    storeRaw(STORAGE_KEYS.templates, { [bad.id]: bad });

    const snapshot = repositories().templates.snapshot();

    expect(snapshot.ok).toBe(true);
    expect(snapshot.ok && snapshot.value.has(bad.id)).toBe(false);
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
  ])(
    'sets aside a stored response with an answer %s, and keeps the others',
    (_case, answersFor) => {
      const name = textField('Name');
      const form = template([name]);
      const good = submittedResponse(form, { [name.id]: text('Ada') });
      const bad = submittedResponse(form);
      storeRaw(STORAGE_KEYS.responses, {
        [good.id]: good,
        [bad.id]: { ...bad, answers: answersFor(name.id) },
      });

      const responses = repositories().responses;
      const snapshot = responses.snapshot();

      expect(snapshot.ok && [...snapshot.value.values()]).toEqual([good]);
      expect(responses.setAside()[0]?.count).toBe(1);
    },
  );
});
