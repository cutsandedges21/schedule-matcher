// @vitest-environment jsdom
// src/components/__tests__/ErrorPage.test.tsx
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import ErrorPage from '../ErrorPage';

afterEach(cleanup);

describe('ErrorPage', () => {
  it('renders the title, body, and a link home', () => {
    window.history.replaceState(null, '');
    render(<ErrorPage title="Page not found" body="That link goes nowhere." />);

    expect(screen.getByText('Page not found')).toBeDefined();
    expect(screen.getByText('That link goes nowhere.')).toBeDefined();
    const home = screen.getByRole('link', { name: 'Go home' });
    expect(home.getAttribute('href')).toBe('/');
  });

  it('hides the Back button on a cold load with no navigation history', () => {
    window.history.replaceState(null, '');
    render(<ErrorPage title="t" body="b" />);

    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('shows a Back button that calls history.back() once react-router has stamped a real index', () => {
    window.history.replaceState({ idx: 2 }, '');
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});

    render(<ErrorPage title="t" body="b" />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(backSpy).toHaveBeenCalledOnce();
    backSpy.mockRestore();
  });

  it('renders an extra action when given one', () => {
    window.history.replaceState(null, '');
    render(<ErrorPage title="t" body="b" extraAction={<button>Reload</button>} />);

    expect(screen.getByText('Reload')).toBeDefined();
  });
});
