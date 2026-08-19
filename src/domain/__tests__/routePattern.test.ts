// src/domain/__tests__/routePattern.test.ts
import { describe, it, expect } from 'vitest';
import { routePattern } from '../routePattern';

describe('routePattern', () => {
  it('passes through a static route unchanged', () => {
    expect(routePattern('/compare')).toBe('/compare');
    expect(routePattern('/settings/customization')).toBe('/settings/customization');
    expect(routePattern('/')).toBe('/');
  });

  it('strips a query string — the whole reason this function exists', () => {
    // /compare?with=alice,bob is a friend graph. Never let it reach the table.
    expect(routePattern('/compare?with=alice,bob')).toBe('/compare');
  });

  it('strips a hash fragment', () => {
    expect(routePattern('/compare#section')).toBe('/compare');
  });

  it('generalises a dynamic segment to its param name', () => {
    expect(routePattern('/u/some-real-student')).toBe('/u/:username');
    expect(routePattern('/compare/alice')).toBe('/compare/:username');
    expect(routePattern('/invite/AB12CD')).toBe('/invite/:code');
  });

  it('falls back to a fixed placeholder for anything unrecognised, rather than logging raw path text', () => {
    expect(routePattern('/definitely/not/a/real/route')).toBe('(unknown route)');
  });
});
