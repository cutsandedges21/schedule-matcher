// @vitest-environment jsdom
// src/features/schedule/__tests__/useLongPress.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useLongPress, LONG_PRESS_MS, LONG_PRESS_SLOP_PX } from '../useLongPress';

// jsdom ships no PointerEvent constructor, so fireEvent.pointerDown would
// dispatch an event with no `button` or coordinates and every assertion here
// would fail for the wrong reason. MouseEvent carries everything the hook
// reads (button, clientX, clientY), so it is a faithful enough stand-in.
if (typeof window.PointerEvent === 'undefined') {
  // @ts-expect-error assigning a minimal stand-in onto the jsdom window
  window.PointerEvent = class PointerEventStub extends MouseEvent {};
}

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function Target({ onLongPress }: { onLongPress: (y: number) => void }) {
  const handlers = useLongPress(onLongPress);
  return <div data-testid="surface" {...handlers} style={{ height: 640 }} />;
}

function down(el: Element, clientY = 100) {
  fireEvent.pointerDown(el, { clientX: 10, clientY, pointerId: 1 });
}

describe('useLongPress', () => {
  it('fires after the press delay', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);

    down(screen.getByTestId('surface'));
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire before the delay has elapsed', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);

    down(screen.getByTestId('surface'));
    vi.advanceTimersByTime(LONG_PRESS_MS - 50);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('is cancelled by a release before the delay', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface);
    fireEvent.pointerUp(surface);
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('is cancelled by movement past the slop threshold — a scroll, not a press', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface, 100);
    fireEvent.pointerMove(surface, { clientX: 10, clientY: 100 + LONG_PRESS_SLOP_PX + 5 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('survives a small tremor within the slop threshold', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');

    down(surface, 100);
    fireEvent.pointerMove(surface, { clientX: 10, clientY: 103 });
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('reports the press position relative to the surface', () => {
    const onLongPress = vi.fn();
    render(<Target onLongPress={onLongPress} />);
    const surface = screen.getByTestId('surface');
    // jsdom gives every element a zero-sized rect, so top is 0 and the
    // offset equals clientY. Enough to prove the value is threaded through.
    down(surface, 250);
    vi.advanceTimersByTime(LONG_PRESS_MS);

    expect(onLongPress).toHaveBeenCalledWith(250);
  });
});
