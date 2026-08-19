// @vitest-environment jsdom
// src/components/__tests__/ErrorBoundary.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

/** Throws during render, the only place a class error boundary can catch. */
function Bomb(): never {
  throw new Error('boom');
}

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>safe content</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('safe content')).toBeDefined();
  });

  it('renders a fallback instead of a blank screen when a child throws', () => {
    // React logs caught render errors to console.error by design; silence it
    // so a passing test still leaves pristine output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeDefined();

    spy.mockRestore();
  });

  it('offers both Reload and Go home — a crashed tree has no nav to escape through', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined();
    const home = screen.getByRole('link', { name: 'Go home' });
    expect(home.getAttribute('href')).toBe('/');

    spy.mockRestore();
  });
});
