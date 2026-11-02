import { submittedResponse, template, textField } from '../test/fixtures';
import type { DraftResponse } from '../domain/response';
import type { FormTemplate } from '../domain/template';
import { deleteTemplate, responsesOf } from './deleteTemplate';
import { STORAGE_KEYS, createRepositories } from './repositories';

const repositories = () => createRepositories(localStorage);

function storedIds() {
  const { templates, responses } = repositories();
  const t = templates.snapshot();
  const r = responses.snapshot();
  return {
    templates: t.ok ? [...t.value.keys()] : null,
    responses: r.ok ? [...r.value.values()].map((response) => response.templateId) : null,
  };
}

/** A response in progress, which the cascade removes along with the submitted ones (D-23). */
function draftOf(form: FormTemplate): DraftResponse {
  const { id, createdAt } = submittedResponse(form);
  return {
    status: 'draft',
    id,
    templateId: form.id,
    values: {},
    templateUpdatedAt: form.updatedAt,
    createdAt,
    updatedAt: createdAt,
  };
}

function seed() {
  const travel = template([textField('Purpose')], 'Travel');
  const other = template([textField('Name')], 'Other');
  const { templates, responses } = repositories();
  templates.put(travel);
  templates.put(other);
  responses.put(submittedResponse(travel));
  responses.put(submittedResponse(travel));
  responses.put(draftOf(travel));
  responses.put(submittedResponse(other));
  return { travel, other };
}

describe('deleteTemplate', () => {
  it('removes the template and every one of its responses, whatever their status', () => {
    const { travel, other } = seed();

    expect(deleteTemplate(repositories(), travel.id)).toEqual({ ok: true, value: undefined });

    expect(storedIds()).toEqual({ templates: [other.id], responses: [other.id] });
  });

  it('counts submitted and in-progress responses apart', () => {
    const { travel } = seed();
    const snapshot = repositories().responses.snapshot();
    if (!snapshot.ok) throw new Error('seeded responses should read');

    const found = responsesOf(snapshot.value, travel.id);

    expect(found).toMatchObject({ submitted: 2, inProgress: 1 });
    expect(found.ids).toHaveLength(3);
  });

  it('keeps the template when its responses cannot be removed, so nothing is orphaned', () => {
    const { travel } = seed();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    const result = deleteTemplate(repositories(), travel.id);

    expect(result).toEqual({ ok: false, error: { kind: 'quota' } });
    vi.restoreAllMocks();
    expect(storedIds().templates).toContain(travel.id);
    expect(storedIds().responses?.filter((id) => id === travel.id)).toHaveLength(3);
  });

  it('refuses, and wipes nothing, when the responses cannot be read', () => {
    const { travel } = seed();
    localStorage.setItem(STORAGE_KEYS.responses, 'not json');

    const result = deleteTemplate(repositories(), travel.id);

    expect(result.ok).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.responses)).toBe('not json');
    expect(storedIds().templates).toContain(travel.id);
  });
});
