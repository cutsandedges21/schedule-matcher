// @vitest-environment jsdom
// src/features/schedule/__tests__/MobileEditor.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useState } from 'react';
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

/**
 * Renders with real parent state, so an edit actually flows back down as a new
 * `value` and re-renders the editor — which is the condition the focus bug
 * needed. `renderEditor`'s vi.fn() onChange never updates value, so it cannot
 * reproduce it.
 */
function renderStateful(initial: ExtractedClass[]) {
  function Wrapper() {
    const [value, setValue] = useState<ExtractedClass[]>(initial);
    return (
      <MobileEditor
        value={value}
        onChange={setValue}
        saving={false}
        error={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    );
  }
  const utils = render(<Wrapper />);
  pickDay('Mon');
  return utils;
}

function openFirstClass() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit BIO 101' }));
}

/** Queries scoped inside the card, away from the page header and the grid. */
function sheet() {
  return within(screen.getByRole('dialog'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Delete class' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet from Cancel without touching the draft', () => {
    const { onChange } = renderEditor([draft()]);
    openFirstClass();

    // Scoped: the page header carries its own Cancel for the whole schedule.
    // The card covers it while open, and aria-modal hides it from assistive
    // tech, but both are in the DOM.
    fireEvent.click(sheet().getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not print the class name as a heading — it is only in the field', () => {
    renderEditor([draft()]);
    openFirstClass();

    // Scoped to the sheet: the grid block behind it legitimately shows the name.
    // getByText does not match input values, so this asserts the name appears
    // nowhere as static text inside the card.
    expect(sheet().queryByText('BIO 101')).toBeNull();
    expect((sheet().getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
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

/**
 * Blurring an input is what dismisses the on-screen keyboard, so "focus stays
 * in the field across an edit" is the testable form of "the keyboard stays up".
 */
describe('MobileEditor keyboard stability', () => {
  it('keeps focus in the field being typed into', () => {
    renderStateful([draft()]);
    openFirstClass();

    const input = screen.getByDisplayValue('BIO 101') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'BIO 102' } });

    // Same element — the field is not remounted, it is only re-rendered.
    expect(document.activeElement).toBe(input);
  });

  it('keeps focus across several characters, not just the first', () => {
    renderStateful([draft({ name: '' })]);

    // Reach the blank class through the sheet: with no name it has no block,
    // so open a new one by long-pressing empty space.
    holdPress(gridColumn(), 0);
    const input = screen.getByLabelText('Class') as HTMLInputElement;
    input.focus();

    for (const text of ['B', 'BI', 'BIO']) {
      fireEvent.change(input, { target: { value: text } });
      expect(document.activeElement).toBe(input);
    }
  });

  it('still returns focus to the opening block once the sheet closes', () => {
    renderStateful([draft()]);
    const block = screen.getByRole('button', { name: 'Edit BIO 101' });
    block.focus();
    fireEvent.click(block);

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit BIO 102' }));
  });
});
