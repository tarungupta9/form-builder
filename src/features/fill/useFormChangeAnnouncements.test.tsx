import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { FieldId } from '../../domain/ids';
import type { ResponseValues } from '../../domain/response';
import { num, numberField, textField } from '../../test/fixtures';
import { LiveRegionProvider } from '../../ui/LiveRegion';
import { SETTLE_MS, useFormChangeAnnouncements } from './useFormChangeAnnouncements';

const type = textField('Expense type');
const nights = numberField('Nights');
const fields = [type, nights];
const NONE: ReadonlySet<FieldId> = new Set();

interface Props {
  visible: ReadonlySet<FieldId>;
  required?: ReadonlySet<FieldId>;
  values?: ResponseValues;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <LiveRegionProvider>{children}</LiveRegionProvider>
);

function renderAnnouncer(initial: Props) {
  return renderHook(
    ({ visible, required = NONE, values = {} }: Props) => {
      useFormChangeAnnouncements(fields, { visible, required }, values);
    },
    { initialProps: initial, wrapper },
  );
}

/** Lets the change settle, then the live region's own batching window pass. */
function settle() {
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS + 300);
  });
}

const spoken = () => screen.getByTestId('live-region').textContent;

describe('useFormChangeAnnouncements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('says nothing about the fields the form opens with', () => {
    renderAnnouncer({ visible: new Set([type.id]) });

    settle();

    expect(spoken()).toBe('');
  });

  it('announces a field that appeared once the change settles, and not before', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id]) });

    rerender({ visible: new Set([type.id, nights.id]) });
    act(() => {
      vi.advanceTimersByTime(SETTLE_MS - 50);
    });
    expect(spoken()).toBe('');

    settle();
    expect(spoken()).toBe('Nights shown.');
  });

  it('does not postpone an announcement while the respondent keeps typing elsewhere', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id]) });
    const shown = new Set([type.id, nights.id]);

    rerender({ visible: shown, values: { [type.id]: num('1') } });
    // Each keystroke re-evaluates the form and hands over a new, equal set.
    for (const input of ['12', '123', '1234']) {
      act(() => {
        vi.advanceTimersByTime(SETTLE_MS / 2);
      });
      rerender({ visible: new Set(shown), values: { [type.id]: num(input) } });
    }
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(spoken()).toBe('Nights shown.');
  });

  it('says nothing when a change is undone before it settles', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id]) });

    rerender({ visible: new Set([type.id, nights.id]) });
    rerender({ visible: new Set([type.id]) });
    settle();

    expect(spoken()).toBe('');
  });

  it('speaks only the net change after flapping, once', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id, nights.id]) });

    rerender({ visible: new Set([type.id]), values: { [nights.id]: num('4') } });
    rerender({ visible: new Set([type.id, nights.id]), values: { [nights.id]: num('4') } });
    rerender({ visible: new Set([type.id]), values: { [nights.id]: num('4') } });
    settle();

    expect(spoken()).toBe('Nights hidden. Its answer won’t be submitted.');
  });

  it('never speaks after the form has gone', () => {
    const { rerender, unmount } = renderAnnouncer({ visible: new Set([type.id]) });

    rerender({ visible: new Set([type.id, nights.id]) });
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces a field becoming required once the change settles, joined with visibility changes', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id]) });

    rerender({ visible: new Set([type.id]), required: new Set([type.id]) });
    settle();
    expect(spoken()).toBe('Expense type is now required.');

    rerender({ visible: new Set([type.id, nights.id]), required: new Set() });
    settle();
    expect(spoken()).toBe('Nights shown. Expense type is no longer required.');
  });

  it('says nothing when a field becomes required and optional again before it settles', () => {
    const { rerender } = renderAnnouncer({ visible: new Set([type.id]) });

    rerender({ visible: new Set([type.id]), required: new Set([type.id]) });
    rerender({ visible: new Set([type.id]), required: new Set() });
    settle();

    expect(spoken()).toBe('');
  });
});
