// @vitest-environment jsdom
// src/features/marketing/__tests__/WifiPage.test.tsx
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WifiPage from '../WifiPage';

const signIn = vi.fn();

/**
 * Mocked at the module boundary so these tests never reach Supabase. The
 * arrow defers the reference to call time — vi.mock is hoisted above the
 * `const` above, so a factory that named `signIn` directly would hit its TDZ.
 */
vi.mock('@/features/auth/signIn', () => ({
  signInWithGoogle: () => signIn(),
}));

afterEach(cleanup);
beforeEach(() => signIn.mockClear());

/**
 * MemoryRouter is the only React context provided, deliberately. There is no
 * AuthProvider, so if someone later makes this page *read* session state,
 * every test in this file throws. That is the regression worth catching: a
 * cold poster scan has to paint the punchline on the first frame, which it
 * cannot do while it waits on a session.
 *
 * Starting a sign-in is a different thing from reading one, and that is why
 * the mocked signIn module above does not weaken this — it is reached by a
 * tap, long after first paint.
 */
function renderPage() {
  render(
    <MemoryRouter initialEntries={['/wifi']}>
      <WifiPage />
    </MemoryRouter>
  );
}

describe('WifiPage', () => {
  it('admits the trick in the h1, with no auth context available', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('There is no wifi.');
    expect(screen.getByText('I lied.')).toBeDefined();
  });

  it('explains what the app does before asking for anything', () => {
    renderPage();

    expect(screen.getByText(/you screenshot your class schedule/i)).toBeDefined();
    expect(screen.getByText(/free at the same time/i)).toBeDefined();
  });

  it('names the app and shows its icon at the pivot into the pitch', () => {
    renderPage();

    // Naming it matters for the scanner who does not sign up on the spot:
    // without this the page describes an app they cannot go and look up.
    expect(screen.getByText('Schedule Matcher')).toBeDefined();

    const icon = document.querySelector('img[src="/icon.svg"]');
    expect(icon).not.toBeNull();

    // Decorative — the name sits beside it as real text, so announcing the
    // image too would just repeat it.
    expect(icon?.getAttribute('alt')).toBe('');
  });

  it('hands off straight to Google, with no login screen in between', () => {
    renderPage();

    // Matched loosely on purpose. The exact wording of this button is still
    // being tuned, and a test that pins the copy verbatim just breaks every
    // time someone improves it. What must not change is what it does.
    fireEvent.click(screen.getByRole('button', { name: /show me/i }));

    expect(signIn).toHaveBeenCalledOnce();
  });

  it('offers no route to the login screen — that tap is the thing being cut', () => {
    renderPage();

    const toLogin = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === '/login');
    expect(toLogin).toEqual([]);
  });

  it('links to the privacy policy and the terms', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'terms' }).getAttribute('href')).toBe('/terms');
  });
});
