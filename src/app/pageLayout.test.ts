import { WORKSPACE_ROUTE, pageLayoutOf } from './pageLayout';

describe('pageLayoutOf', () => {
  it('is a document when no route names a layout', () => {
    expect(pageLayoutOf([{ handle: undefined }, { handle: undefined }])).toBe('document');
    expect(pageLayoutOf([])).toBe('document');
  });

  it('is a workspace when the matched page asks for one', () => {
    expect(pageLayoutOf([{ handle: undefined }, { handle: WORKSPACE_ROUTE }])).toBe('workspace');
  });

  it('lets the deepest route that names a layout win', () => {
    expect(pageLayoutOf([{ handle: WORKSPACE_ROUTE }, { handle: { layout: 'document' } }])).toBe(
      'document',
    );
  });

  it('ignores a handle that is not a layout', () => {
    expect(
      pageLayoutOf([
        { handle: WORKSPACE_ROUTE },
        { handle: { layout: 'sideways' } },
        { handle: 'workspace' },
        { handle: null },
      ]),
    ).toBe('workspace');
  });
});
