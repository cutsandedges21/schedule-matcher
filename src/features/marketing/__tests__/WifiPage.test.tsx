// @vitest-environment jsdom
// src/features/marketing/__tests__/WifiPage.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WifiPage from '../WifiPage';

afterEach(cleanup);

/**
 * MemoryRouter is the *only* context provided, deliberately. There is no
 * AuthProvider and no Supabase mock here, so if someone later makes this page
 * read session state, every test in this file throws. That is the regression
 * this file exists to catch: a cold poster scan has to paint the punchline on
 * the first frame, which it cannot do if it is waiting on a session.
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

  it('sends the reader to /login rather than signing in inline', () => {
    renderPage();

    // Matched loosely on purpose. The exact wording of this button is still
    // being tuned, and a test that pins the copy verbatim just breaks every
    // time someone improves it. What must not change is where it goes.
    const cta = screen.getByRole('link', { name: /show me/i });
    expect(cta.getAttribute('href')).toBe('/login');
  });

  it('links to the privacy policy and the terms', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'terms' }).getAttribute('href')).toBe('/terms');
  });
});
