// @vitest-environment jsdom
// src/features/schedule/__tests__/MobileEditor.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, within } from '@testing-library/react';
import MobileEditor from '../MobileEditor';
import { LONG_PRESS_MS } from '../useLongPress';
import type { ExtractedClass } from '@/domain/types';

// See the same note in useLongPress.test.tsx — jsdom has no PointerEvent.
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error assigning a minimal stand-in onto the jsdom window
  window.PointerEvent = class PointerEventStub extends MouseEvent {};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101', instructor: null, room: null, courseCode: null, section: null,
    days: [1], startMinute: 600, endMinute: 650,
    ...over,
  };
}

/**
 * DaySelector's chips and ClassCard's day toggles share the same aria-labels
 * ("Mon", "Wed", ...), so with the sheet open a bare screen query matches both.
 * DaySelector is the only sticky element on the page.
 */
function daySelector() {
  return within(document.querySelector('.sticky') as HTMLElement);
}

function pickDay(label: string) {
  fireEvent.click(daySelector().getByRole('button', { name: label }));
}

/** Renders with day 1 (Monday) selected, so the seeded class is visible. */
function renderEditor(value: ExtractedClass[], onChange = vi.fn()) {
  const utils = render(
    <MobileEditor
      value={value}
      onChange={onChange}
      saving={false}
      error={null}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />
  );
  pickDay('Mon');
  return { ...utils, onChange };
}

function openFirstClass() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit BIO 101' }));
}

/**
 * The long-press fires from a setTimeout, so the state update it triggers
 * lands outside React's batching — fireEvent wraps itself in act(), but
 * advancing timers does not.
 */
function holdPress(target: Element, clientY: number) {
  fireEvent.pointerDown(target, { button: 0, clientX: 10, clientY, pointerId: 1 });
  act(() => {
    vi.advanceTimersByTime(LONG_PRESS_MS);
  });
}

function gridColumn() {
  return document.querySelector('.touch-pan-y') as HTMLElement;
}

describe('MobileEditor', () => {
  it('shows the long-press hint, which is the only cue for adding', () => {
    renderEditor([draft()]);
    expect(screen.getByText(/press and hold an empty slot/i)).toBeDefined();
  });

  it('opens the sheet for a tapped class', () => {
    renderEditor([draft()]);
    openFirstClass();

    expect(screen.getByRole('dialog', { name: 'Edit BIO 101' })).toBeDefined();
    expect((screen.getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
  });

  it('writes edits straight through to the draft, so the grid can preview them', () => {
    const { onChange } = renderEditor([draft()]);
    openFirstClass();

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].name).toBe('BIO 102');
  });

  it('closes the sheet on Done', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes the class from the sheet header', () => {
    const { onChange } = renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet on Escape', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet when the backdrop is tapped', () => {
    renderEditor([draft()]);
    openFirstClass();

    fireEvent.click(screen.getByTestId('sheet-backdrop'));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet when the visible day changes', () => {
    renderEditor([draft()]);
    openFirstClass();

    pickDay('Wed');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('appends a long-pressed class only once Done is pressed', () => {
    const { onChange } = renderEditor([draft()]);

    holdPress(gridColumn(), 0);

    expect(screen.getByRole('dialog', { name: 'Add a class' })).toBeDefined();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it('edits rather than creates when an existing block is long-pressed', () => {
    const { onChange } = renderEditor([draft()]);

    holdPress(screen.getByRole('button', { name: 'Edit BIO 101' }), 100);

    // The guard in ScheduleGrid stops the press reaching the create handler.
    expect(screen.queryByRole('dialog', { name: 'Add a class' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves no trace when a new-class sheet is dismissed without Done', () => {
    const { onChange } = renderEditor([draft()]);

    holdPress(gridColumn(), 0);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables Save when every class has been deleted', () => {
    renderEditor([]);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
