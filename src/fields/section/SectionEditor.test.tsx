import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Field, FieldOf, SectionSize } from '../../domain/template';
import { sectionField, textField } from '../../test/fixtures';
import { SectionEditor } from './SectionEditor';

const SKIP = /skips a heading level/;

/** The editor over a small form, keeping its edits as the builder would. */
function Harness({ before, size }: { before: Field[]; size: SectionSize }) {
  const [field, setField] = useState<FieldOf<'section'>>(() => sectionField('This one', size));
  return (
    <SectionEditor field={field} context={{ fields: [...before, field] }} onChange={setField} />
  );
}

describe('Section header editor', () => {
  it('hints when the first header skips a level below the form title', () => {
    render(<Harness before={[textField()]} size="lg" />);

    expect(screen.getByRole('status')).toHaveTextContent(SKIP);
    expect(screen.getByRole('status')).toHaveTextContent(/after the form title/);
  });

  it('hints when a header skips a level below the header above it', () => {
    render(<Harness before={[sectionField('Above', 'xl'), textField()]} size="md" />);

    expect(screen.getByRole('status')).toHaveTextContent(/after the section header above/);
  });

  it('gives no hint for a first extra-large header, or one level below the header above', () => {
    const { unmount } = render(<Harness before={[]} size="xl" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    unmount();

    render(<Harness before={[sectionField('Above', 'xl')]} size="lg" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('announces the hint in its live region when a size change makes the header skip', async () => {
    render(<Harness before={[sectionField('Above', 'xl')]} size="lg" />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Size' }), 'Small');

    // The same live region, now with text, so screen readers hear the change.
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent(SKIP);
  });
});
