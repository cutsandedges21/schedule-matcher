// @vitest-environment jsdom
// src/components/__tests__/BottomNav.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from '../BottomNav';

afterEach(cleanup);

function pillTransform(): string | null {
  return document.querySelector<HTMLElement>('[aria-hidden]')?.style.transform ?? null;
}

describe('BottomNav', () => {
  it('parks the pill at the first slot for the root route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>
    );

    expect(pillTransform()).toBe('translateX(0%)');
  });

  it('slides the pill one slot per tab — index 1 for Friends, index 2 for Settings', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/friends']}>
        <BottomNav />
      </MemoryRouter>
    );
    expect(pillTransform()).toBe('translateX(100%)');
    unmount();

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <BottomNav />
      </MemoryRouter>
    );
    expect(pillTransform()).toBe('translateX(200%)');
  });

  it('follows a subpath of a tab, same as the tab itself', () => {
    render(
      <MemoryRouter initialEntries={['/settings/customization']}>
        <BottomNav />
      </MemoryRouter>
    );

    expect(pillTransform()).toBe('translateX(200%)');
  });

  it('renders no pill at all on a route that is not a nav destination', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <BottomNav />
      </MemoryRouter>
    );

    expect(pillTransform()).toBeNull();
  });

  it('still renders all three labels', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByText('Schedule')).toBeDefined();
    expect(screen.getByText('Friends')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });
});
