import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { text, textareaField } from '../../test/fixtures';
import { TextareaRenderer } from './TextareaRenderer';

describe('Long text renderer', () => {
  it('is a labelled multi-line box of the configured height, with its limits as a hint', () => {
    const field = textareaField('Trip notes', {
      config: { placeholder: '', rows: 6, maxLength: 200 },
    });
    render(
      <TextareaRenderer
        field={field}
        value={undefined}
        required
        error={null}
        controlId="answer"
        context={{ fields: [] }}
        onChange={vi.fn()}
      />,
    );

    const box = screen.getByRole('textbox', { name: /Trip notes/ });
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('rows', '6');
    expect(box).toBeRequired();
    expect(box).toHaveAccessibleDescription('Up to 200 characters.');
  });

  it('emits a text value with the line breaks the respondent typed', async () => {
    const onChange = vi.fn();
    render(
      <TextareaRenderer
        field={textareaField('Notes')}
        value={text('Line one')}
        required={false}
        error={null}
        controlId="answer"
        context={{ fields: [] }}
        onChange={onChange}
      />,
    );

    await userEvent.type(screen.getByRole('textbox', { name: 'Notes' }), '{Enter}');

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'text', value: 'Line one\n' });
  });
});
