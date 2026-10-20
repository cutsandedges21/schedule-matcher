// @vitest-environment jsdom
// src/components/__tests__/BottomNav.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';

afterEach(cleanup);

function pillTransform(): string | null {
  return document.querySelector<HTMLElement>('[data-nav-pill]')?.style.transform ?? null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  );
}

describe('BottomNav', () => {
  it('parks the pill at the first slot for the root route', () => {
    renderAt('/');
    expect(pillTransform()).toBe('translateX(0%)');
  });

  it('slides the pill one slot per tab', () => {
    const cases: Array<[string, string]> = [
      ['/schedule', 'translateX(100%)'],
      ['/spaces', 'translateX(200%)'],
      ['/calendar', 'translateX(300%)'],
      ['/tasks', 'translateX(400%)'],
    ];
    for (const [path, transform] of cases) {
      const { unmount } = renderAt(path);
      expect(pillTransform()).toBe(transform);
      unmount();
    }
  });

  it('follows a subpath of a tab, same as the tab itself', () => {
    renderAt('/spaces/abc/members');
    expect(pillTransform()).toBe('translateX(200%)');
  });

  it('renders no pill at all on a route that is not a tab', () => {
    renderAt('/upload');
    expect(pillTransform()).toBeNull();
  });

  it('renders no pill for Friends and Settings, which live in the top bar on a phone', () => {
    const { unmount } = renderAt('/friends');
    expect(pillTransform()).toBeNull();
    unmount();

    renderAt('/settings');
    expect(pillTransform()).toBeNull();
  });

  it('renders every tab label', () => {
    renderAt('/');
    for (const label of ['Home', 'Schedule', 'Spaces', 'Calendar', 'Tasks']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });
});
