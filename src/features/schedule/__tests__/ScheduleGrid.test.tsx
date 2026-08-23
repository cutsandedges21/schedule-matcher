// @vitest-environment jsdom
// src/features/schedule/__tests__/ScheduleGrid.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import ScheduleGrid from '../ScheduleGrid';
import { LONG_PRESS_MS } from '../useLongPress';
import type { ClassMeeting } from '@/domain/types';

/**
 * The day/week switch. What jsdom can answer is which panes exist and what they
 * contain — Tailwind's breakpoints never run here, so "does the week actually
 * read on a 375px screen" stays a manual check.
 */

// See useLongPress.test.tsx — jsdom has no PointerEvent.
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error assigning a minimal stand-in onto the jsdom window
  window.PointerEvent = class PointerEventStub extends MouseEvent {};
}

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: 'c1',
    name: 'BIO 101',
    instructor: null,
    room: null,
    courseCode: null,
    section: null,
    days: [1],
    startMinute: 600,
    endMinute: 650,
    color: 'indigo',
    ...over,
  };
}

function toWeek() {
  fireEvent.click(screen.getByRole('button', { name: 'Week' }));
}

/** The day pane is the only one rendered without weekday headers over it. */
function dayPane(): HTMLElement | null {
  return document.querySelector('.lg\\:hidden.touch-pan-y');
}

function blockNames(): string[] {
  return Array.from(document.querySelectorAll('[data-class-block] .font-semibold')).map(
    (el) => el.textContent ?? ''
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('ScheduleGrid day/week switch', () => {
  it('starts on the day view, with the day chips to pick between', () => {
    render(<ScheduleGrid classes={[meeting()]} />);

    expect((screen.getByRole('button', { name: 'Day' }) as HTMLElement).ariaPressed).toBe('true');
    // DaySelector labels its chips with the short day name, not the initial.
    expect(screen.getByRole('button', { name: 'Mon' })).toBeDefined();
    expect(dayPane()).not.toBeNull();
  });

  it('drops the day chips in week view — every day is already on screen', () => {
    render(<ScheduleGrid classes={[meeting()]} />);
    toWeek();

    expect(screen.queryByRole('button', { name: 'Mon' })).toBeNull();
    expect(dayPane()).toBeNull();
  });

  it('shows a class on each of its days at once', () => {
    render(<ScheduleGrid classes={[meeting({ days: [1, 3, 5] })]} />);
    toWeek();

    // One block per meeting day, and no second copy from a hidden day pane.
    expect(blockNames()).toEqual(['BIO 101', 'BIO 101', 'BIO 101']);
  });

  it('remembers the choice for the next visit', () => {
    const first = render(<ScheduleGrid classes={[meeting()]} />);
    toWeek();
    first.unmount();

    render(<ScheduleGrid classes={[meeting()]} />);

    expect((screen.getByRole('button', { name: 'Week' }) as HTMLElement).ariaPressed).toBe('true');
    expect(dayPane()).toBeNull();
  });

  it('survives a browser that refuses localStorage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    render(<ScheduleGrid classes={[meeting()]} />);
    toWeek();

    // The preference is lost, but the switch still works for this session.
    expect(dayPane()).toBeNull();

    setItem.mockRestore();
    getItem.mockRestore();
  });
});

describe('ScheduleGrid week view in edit mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Advancing timers is outside React's batching, unlike fireEvent. */
  function holdPress(target: Element, clientY: number) {
    fireEvent.pointerDown(target, { button: 0, clientX: 10, clientY, pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
  }

  function weekColumn(index: number): Element {
    return document.querySelectorAll('.touch-pan-y')[index];
  }

  it('names blocks by day, so two meetings of one class are distinguishable', () => {
    render(<ScheduleGrid classes={[meeting({ days: [1, 3] })]} onSelectClass={vi.fn()} />);
    toWeek();

    expect(screen.getByRole('button', { name: 'Edit BIO 101, Mon' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit BIO 101, Wed' })).toBeDefined();
  });

  it('edits the tapped class', () => {
    const onSelectClass = vi.fn();
    render(<ScheduleGrid classes={[meeting()]} onSelectClass={onSelectClass} />);
    toWeek();

    fireEvent.click(screen.getByRole('button', { name: 'Edit BIO 101, Mon' }));

    expect(onSelectClass).toHaveBeenCalledTimes(1);
    expect(onSelectClass.mock.calls[0][0].name).toBe('BIO 101');
  });

  /**
   * The regression this view invites: one long-press timer serves seven
   * columns, so a day read from state when it fires — rather than carried from
   * the column that was pressed — would file every creation under Monday.
   */
  it('creates on the column that was pressed, not the day the chips were left on', () => {
    const onCreateAt = vi.fn();
    render(<ScheduleGrid classes={[meeting()]} onCreateAt={onCreateAt} />);
    toWeek();

    holdPress(weekColumn(3), 0); // Thursday
    expect(onCreateAt.mock.calls[0][0]).toBe(4);

    holdPress(weekColumn(1), 0); // Tuesday
    expect(onCreateAt.mock.calls[1][0]).toBe(2);
  });

  it('edits rather than creates when a block itself is long-pressed', () => {
    const onCreateAt = vi.fn();
    render(<ScheduleGrid classes={[meeting()]} onSelectClass={vi.fn()} onCreateAt={onCreateAt} />);
    toWeek();

    holdPress(screen.getByRole('button', { name: 'Edit BIO 101, Mon' }), 100);

    expect(onCreateAt).not.toHaveBeenCalled();
  });

  it('reports the switch itself, so an open sheet can close', () => {
    const onDayChange = vi.fn();
    render(<ScheduleGrid classes={[meeting()]} onDayChange={onDayChange} />);

    toWeek();
    expect(onDayChange).toHaveBeenCalledTimes(1);

    // Re-picking the view already showing changes nothing and closes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onDayChange).toHaveBeenCalledTimes(1);
  });
});
