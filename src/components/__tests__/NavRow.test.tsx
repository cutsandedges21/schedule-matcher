// @vitest-environment jsdom
// src/components/__tests__/NavRow.test.tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavRow from '../NavRow';

afterEach(cleanup);

describe('NavRow', () => {
  it('renders an internal row as an in-app link with the chevron glyph', () => {
    render(
      <MemoryRouter>
        <NavRow to="/privacy" label="Privacy Policy" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: /Privacy Policy/ });
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(link.getAttribute('target')).toBeNull();
    expect(screen.getByText('›')).toBeDefined();
  });

  it('renders an external row as a new-tab link with a description and the leaving-app glyph', () => {
    render(<NavRow href="https://example.com" label="Example" description="An example site" />);

    const link = screen.getByRole('link', { name: /Example/ });
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText('An example site')).toBeDefined();
    expect(screen.getByText('↗')).toBeDefined();
  });
});
