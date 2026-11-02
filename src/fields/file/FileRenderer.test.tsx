import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { FilesValue } from '../../domain/response';
import type { FieldOf } from '../../domain/template';
import { expectNoAxeViolations } from '../../test/axe';
import { fileField } from '../../test/fixtures';
import { ANNOUNCE_BATCH_MS, LiveRegionProvider } from '../../ui/LiveRegion';
import { FileRenderer } from './FileRenderer';

const pdf = (name = 'hotel.pdf') => new File(['%PDF'], name, { type: 'application/pdf' });
const txt = () => new File(['notes'], 'notes.txt', { type: 'text/plain' });

function Harness({
  field,
  onChange,
}: {
  field: FieldOf<'file'>;
  onChange?: (value: FilesValue) => void;
}) {
  const [value, setValue] = useState<FilesValue>();
  return (
    <FileRenderer
      field={field}
      value={value}
      required={false}
      error={null}
      controlId="answer-receipts"
      context={{ fields: [field] }}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

function renderField(
  config: Partial<FieldOf<'file'>['config']> = {},
  onChange = vi.fn<(value: FilesValue) => void>(),
) {
  const field = fileField('Receipts', config);
  const view = render(
    <LiveRegionProvider>
      <Harness field={field} onChange={onChange} />
    </LiveRegionProvider>,
  );
  return { ...view, onChange };
}

// The picker's `accept` filter is bypassed, as a respondent choosing "All files" would.
const setup = () => userEvent.setup({ applyAccept: false });
const picker = () => screen.getByLabelText('Choose files');
const added = () => screen.queryByRole('list', { name: 'Files added to Receipts' });

describe('File upload renderer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps only the metadata of an allowed file, and lists it', async () => {
    const { onChange } = renderField({ allowedTypes: ['.pdf'] });

    await setup().upload(picker(), pdf());

    expect(onChange.mock.lastCall?.[0]).toMatchObject({
      kind: 'files',
      value: [{ name: 'hotel.pdf', size: 4, type: 'application/pdf' }],
    });
    expect(within(added()!).getByRole('listitem')).toHaveTextContent('hotel.pdf4 B, PDF');
  });

  it('rejects a file of a disallowed type even when the picker filter is bypassed', async () => {
    const { onChange } = renderField({ allowedTypes: ['.pdf'] });

    await setup().upload(picker(), txt());

    expect(onChange).not.toHaveBeenCalled();
    expect(added()).not.toBeInTheDocument();
    expect(screen.getByText('notes.txt is not PDF.')).toBeVisible();
    expect(picker()).toHaveAccessibleDescription(/notes\.txt is not PDF\./);
  });

  it('adds the allowed files of a mixed choice and explains the refused one', async () => {
    const { onChange } = renderField({ allowedTypes: ['.pdf'] });

    await setup().upload(picker(), [pdf(), txt()]);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: [expect.objectContaining({ name: 'hotel.pdf' })] }),
    );
    expect(screen.getByText('notes.txt is not PDF.')).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCE_BATCH_MS));
    expect(screen.getByTestId('live-region')).toHaveTextContent(
      '1 file added. notes.txt is not PDF.',
    );
  });

  it('stops at the file limit, says so, and disables the picker once full', async () => {
    renderField({ maxFiles: 2 });

    await setup().upload(picker(), [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);

    expect(within(added()!).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Only 2 files can be added.')).toBeVisible();
    expect(picker()).toBeDisabled();
  });

  it('removes a file, announces it and returns focus to the picker', async () => {
    const user = setup();
    renderField({ maxFiles: 1 });
    await user.upload(picker(), pdf());

    await user.click(screen.getByRole('button', { name: 'Remove hotel.pdf' }));

    expect(added()).not.toBeInTheDocument();
    expect(picker()).toBeEnabled();
    expect(picker()).toHaveFocus();
    await act(() => vi.advanceTimersByTimeAsync(ANNOUNCE_BATCH_MS));
    expect(screen.getByTestId('live-region')).toHaveTextContent('hotel.pdf removed.');
  });

  it('tells the respondent the allowed types and limit before they choose', () => {
    renderField({ allowedTypes: ['.pdf', 'image/*'], maxFiles: 3 });
    expect(screen.getByRole('group', { name: 'Receipts' })).toHaveAccessibleDescription(
      'PDF or image files, up to 3 files.',
    );
  });

  it('has no axe violations with a file added', async () => {
    const { container } = renderField();
    await setup().upload(picker(), pdf());
    await expectNoAxeViolations(container);
  });
});
