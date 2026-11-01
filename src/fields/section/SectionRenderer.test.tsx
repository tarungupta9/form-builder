import { render, screen } from '@testing-library/react';
import type { SectionSize } from '../../domain/template';
import { sectionField } from '../../test/fixtures';
import { SectionRenderer } from './SectionRenderer';

describe('Section header renderer', () => {
  it.each<[SectionSize, number]>([
    ['xl', 2],
    ['lg', 3],
    ['md', 4],
    ['sm', 5],
    ['xs', 6],
  ])('renders size %s as a level %i heading, below the form title (D-18)', (size, level) => {
    render(
      <SectionRenderer
        field={sectionField('Trip details', size)}
        value={undefined}
        required={false}
        error={null}
        controlId="answer"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { level, name: 'Trip details' })).toBeInTheDocument();
  });
});
