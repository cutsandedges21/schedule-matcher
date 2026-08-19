// @vitest-environment jsdom
// src/features/error/__tests__/NotFoundPage.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NotFoundPage from '../NotFoundPage';

afterEach(cleanup);

describe('NotFoundPage', () => {
  it('tells the student the page does not exist and offers a way home', () => {
    window.history.replaceState(null, '');
    render(<NotFoundPage />);

    expect(screen.getByText('Page not found')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Go home' })).toBeDefined();
  });
});
