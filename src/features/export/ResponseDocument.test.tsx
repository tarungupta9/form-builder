import { render, screen, within } from '@testing-library/react';
import { newResponseId, toIsoDateTime } from '../../domain/ids';
import type { ExportBlock } from '../../fields/contract';
import { expectNoAxeViolations } from '../../test/axe';
import { formatSubmittedAt } from '../../ui/format';
import type { ExportDocument } from './exportModel';
import { ResponseDocument } from './ResponseDocument';

/**
 * Hand-built documents, because only Short text exports today. Every block and value shape is
 * rendered here, so the types that arrive later (sections, lists, notes) need no change to the
 * view: that would be a seam leak (ADR 0011).
 */
const exportDocument = (overrides: Partial<ExportDocument> = {}): ExportDocument => ({
  title: 'Expense claim',
  description: 'Claim back what you spent on company business.',
  responseId: newResponseId(),
  submittedAt: toIsoDateTime(new Date('2026-11-01T09:05:00Z')),
  blocks: [],
  ...overrides,
});

const answer = (label: string, value: Extract<ExportBlock, { kind: 'answer' }>['value']) =>
  ({ kind: 'answer', label, value }) as const;

/** The value shown for the answer labelled `label`. */
const valueOf = (label: string) => screen.getByText(label).closest('div')!.querySelector('dd')!;

describe('ResponseDocument', () => {
  it('shows the title, the description, "Submitted …" with its zone, and the response ID', () => {
    const doc = exportDocument();

    render(<ResponseDocument document={doc} />);

    const article = screen.getByRole('article', { name: 'Expense claim' });
    const scope = within(article);
    expect(scope.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible();
    expect(scope.getByText('Claim back what you spent on company business.')).toBeVisible();
    const submitted = scope.getByText(formatSubmittedAt(doc.submittedAt));
    expect(submitted.tagName).toBe('TIME');
    expect(submitted).toHaveAttribute('dateTime', doc.submittedAt);
    expect(scope.getByText('Submitted')).toBeVisible();
    expect(scope.getByText('Response ID')).toBeVisible();
    expect(scope.getByText(doc.responseId)).toBeVisible();
  });

  it('omits the description paragraph when it is empty', () => {
    const { container } = render(
      <ResponseDocument document={exportDocument({ description: '' })} />,
    );

    expect(container.querySelector('header p')).toBeNull();
  });

  it('lists each answer under its label, in the order given', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [
            answer('Employee name', { kind: 'text', text: 'Ada Lovelace' }),
            answer('Purpose', { kind: 'text', text: 'Conference' }),
          ],
        })}
      />,
    );

    const labels = screen.getAllByRole('term').map((term) => term.textContent);
    expect(labels).toEqual(['Submitted', 'Response ID', 'Employee name', 'Purpose']);
    expect(valueOf('Employee name')).toHaveTextContent('Ada Lovelace');
  });

  it('reads "Not answered" for an empty value, or the plugin’s own empty text', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [
            answer('Notes', { kind: 'empty' }),
            answer('Total', { kind: 'empty', text: 'Nothing to calculate' }),
          ],
        })}
      />,
    );

    expect(valueOf('Notes')).toHaveTextContent('Not answered');
    expect(valueOf('Total')).toHaveTextContent('Nothing to calculate');
  });

  it('keeps the line breaks of a text answer', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [answer('Address', { kind: 'text', text: '1 High St\nLondon' })],
        })}
      />,
    );

    // Not normalised, so the browser shows the line break (white-space: pre-wrap).
    expect(valueOf('Address').textContent).toBe('1 High St\nLondon');
  });

  it('shows a list answer as a list, in the order given', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [answer('Expenses', { kind: 'list', items: ['Hotel', 'Taxi'] })],
        })}
      />,
    );

    const items = within(valueOf('Expenses')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Hotel', 'Taxi']);
  });

  it('shows a plugin’s note under the answer it explains', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [
            {
              ...answer('Receipts', { kind: 'list', items: ['receipt.pdf · 2.4 MB · PDF'] }),
              note: 'Attachments are listed by name only.',
            },
          ],
        })}
      />,
    );

    expect(
      within(valueOf('Receipts')).getByText('Attachments are listed by name only.'),
    ).toBeVisible();
  });

  it('shows a section as a heading at its own level, between the answers around it', () => {
    render(
      <ResponseDocument
        document={exportDocument({
          blocks: [
            answer('Name', { kind: 'text', text: 'Ada' }),
            { kind: 'section', text: 'Travel', level: 2 },
            answer('Destination', { kind: 'text', text: 'Paris' }),
            { kind: 'section', text: 'Hotel', level: 3 },
          ],
        })}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Travel' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: 'Hotel' })).toBeVisible();
    // The answers either side of a section are separate description lists.
    expect(screen.getByText('Name').closest('dl')).not.toBe(
      screen.getByText('Destination').closest('dl'),
    );
  });

  it.each([2, 3, 4, 5, 6] as const)('renders a level-%i section as an h%i', (level) => {
    render(
      <ResponseDocument
        document={exportDocument({ blocks: [{ kind: 'section', text: 'Part', level }] })}
      />,
    );

    expect(screen.getByRole('heading', { level, name: 'Part' })).toBeVisible();
  });

  it('has no axe violations with answers, an empty answer, a list, a note and sections at every level', async () => {
    const { container } = render(
      <ResponseDocument
        document={exportDocument({
          blocks: [
            answer('Name', { kind: 'text', text: 'Ada' }),
            answer('Notes', { kind: 'empty' }),
            { kind: 'section', text: 'Travel', level: 2 },
            answer('Expenses', { kind: 'list', items: ['Hotel', 'Taxi'] }),
            { ...answer('Receipts', { kind: 'list', items: ['a.pdf'] }), note: 'Names only.' },
            { kind: 'section', text: 'Hotel', level: 3 },
            { kind: 'section', text: 'Room', level: 4 },
            { kind: 'section', text: 'Bed', level: 5 },
            { kind: 'section', text: 'Pillow', level: 6 },
            answer('Nights', { kind: 'text', text: '3' }),
          ],
        })}
      />,
    );

    await expectNoAxeViolations(container);
  });
});
