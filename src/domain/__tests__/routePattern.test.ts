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

  it('generalises space ids and invite codes, which identify a private group', () => {
    const id = '7b0c6f9e-2d7c-4f61-9a39-1b9d5b3c2a10';
    expect(routePattern(`/spaces/${id}`)).toBe('/spaces/:spaceId');
    expect(routePattern(`/spaces/${id}/members`)).toBe('/spaces/:spaceId/members');
    expect(routePattern(`/spaces/${id}/events/new`)).toBe('/spaces/:spaceId/events/new');
    expect(routePattern(`/spaces/${id}/events/${id}`)).toBe('/spaces/:spaceId/events/:eventId');
    expect(routePattern(`/spaces/${id}/polls/new`)).toBe('/spaces/:spaceId/polls/new');
    expect(routePattern('/join/aB3_dE5-fG7hJ9kL1mN2pQ')).toBe('/join/:code');
  });

  it('keeps the static /spaces/new ahead of /spaces/:spaceId', () => {
    expect(routePattern('/spaces/new')).toBe('/spaces/new');
  });

  it('falls back to a fixed placeholder for anything unrecognised, rather than logging raw path text', () => {
    expect(routePattern('/definitely/not/a/real/route')).toBe('(unknown route)');
  });
});
