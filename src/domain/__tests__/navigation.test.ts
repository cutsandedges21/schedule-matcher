// src/domain/__tests__/navigation.test.ts
import { describe, it, expect } from 'vitest';
import { canGoBack } from '../navigation';

describe('canGoBack', () => {
  it('is true once react-router has stamped a positive index on history.state', () => {
    expect(canGoBack({ idx: 1 })).toBe(true);
    expect(canGoBack({ idx: 5 })).toBe(true);
  });

  it('is false at the first entry — idx 0 means nothing to go back to', () => {
    expect(canGoBack({ idx: 0 })).toBe(false);
  });

  it('is false with no history state — a cold load from a shared link or typed URL', () => {
    expect(canGoBack(null)).toBe(false);
    expect(canGoBack(undefined)).toBe(false);
  });

  it('is false when idx is missing or not a number', () => {
    expect(canGoBack({})).toBe(false);
    expect(canGoBack({ idx: 'first' })).toBe(false);
  });
});
