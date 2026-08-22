// @vitest-environment jsdom
// src/features/schedule/__tests__/SchedulePage.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ClassMeeting } from '@/domain/types';

/**
 * Covers the edit-mode behaviour from the plan's Task 6 browser checklist.
 * The visual question the spec left open — how the week grid reads at half
 * width — is a rendering concern jsdom cannot answer and stays a manual check.
 *
 * `useSchedule` is mocked at the module boundary so these tests exercise the
 * page's own state machine (draft, baseline, dirty, save) rather than Supabase.
 * ScheduleGrid renders for real, so the live preview assertions also cover
 * `extractedToPreviewMeetings`.
 */

const saveSchedule = vi.fn();
const reload = vi.fn();
let currentClasses: ClassMeeting[] = [];

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    profile: { username: 'sam' },
  }),
}));

vi.mock('../useSchedule', () => ({
  useSchedule: () => ({ classes: currentClasses, loading: false, error: null, reload }),
  saveSchedule: (next: unknown) => saveSchedule(next),
}));

const { default: SchedulePage } = await import('../SchedulePage');

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

function renderPage() {
  return render(
    <MemoryRouter>
      <SchedulePage />
    </MemoryRouter>
  );
}

/** The desktop week grid is `hidden lg:flex`, so scope queries to it. */
function desktopBlockNames(): string[] {
  return Array.from(document.querySelectorAll('.lg\\:flex .truncate.font-semibold')).map(
    (el) => el.textContent ?? ''
  );
}

beforeEach(() => {
  currentClasses = [meeting()];
  saveSchedule.mockReset().mockResolvedValue(undefined);
  reload.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SchedulePage edit mode', () => {
  it('offers Edit when a schedule exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('offers no Edit button when there is no schedule', () => {
    currentClasses = [];
    renderPage();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('swaps to the editor, pre-filled with the saved schedule', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit schedule' })).toBeDefined();
    expect((screen.getByDisplayValue('BIO 101') as HTMLInputElement).value).toBe('BIO 101');
  });

  it('updates the grid live as a class is renamed', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(desktopBlockNames()).toContain('BIO 101');

    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'MATH 220' } });

    expect(desktopBlockNames()).toContain('MATH 220');
    expect(desktopBlockNames()).not.toContain('BIO 101');
  });

  it('drops the block from the grid when a class is removed', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove class' }));

    expect(desktopBlockNames()).toHaveLength(0);
  });

  it('leaves edit mode with no prompt when nothing changed', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'My schedule' })).toBeDefined();
  });

  it('prompts before discarding real changes, and stays put when declined', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    // Still editing, and the edit survived the declined discard.
    expect(screen.getByRole('heading', { name: 'Edit schedule' })).toBeDefined();
    expect((screen.getByDisplayValue('BIO 102') as HTMLInputElement).value).toBe('BIO 102');
  });

  it('discards and exits when the prompt is accepted', () => {
    vi.stubGlobal('confirm', vi.fn(() => true));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'My schedule' })).toBeDefined();
  });

  it('saves the edited draft, reloads, and returns to the schedule', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'My schedule' })).toBeDefined());

    expect(saveSchedule).toHaveBeenCalledTimes(1);
    expect(saveSchedule.mock.calls[0][0][0].name).toBe('BIO 102');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft and shows the reason when saving fails', async () => {
    saveSchedule.mockRejectedValue(new Error('Could not save your schedule. Nothing was changed.'));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByDisplayValue('BIO 101'), { target: { value: 'BIO 102' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.getByText('Could not save your schedule. Nothing was changed.')).toBeDefined()
    );

    // Still in the editor, edit intact — a failed save changed nothing.
    expect(screen.getByRole('heading', { name: 'Edit schedule' })).toBeDefined();
    expect((screen.getByDisplayValue('BIO 102') as HTMLInputElement).value).toBe('BIO 102');
  });

  it('blocks saving a schedule emptied of every class', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove class' }));

    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
