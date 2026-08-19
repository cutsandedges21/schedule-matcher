// src/domain/__tests__/errorFingerprint.test.ts
import { describe, it, expect } from 'vitest';
import { errorFingerprint } from '../errorFingerprint';

describe('errorFingerprint', () => {
  it('is stable for the same message and stack', () => {
    const stack = 'Error: boom\n    at Bomb (App.tsx:10:5)\n    at renderWithHooks (react-dom.js:1:1)';
    expect(errorFingerprint('boom', stack)).toBe(errorFingerprint('boom', stack));
  });

  it('differs for a different message', () => {
    expect(errorFingerprint('boom', undefined)).not.toBe(errorFingerprint('bang', undefined));
  });

  it('differs when the first stack frame differs', () => {
    const a = 'Error: boom\n    at Bomb (App.tsx:10:5)\n    at renderWithHooks (react-dom.js:1:1)';
    const b = 'Error: boom\n    at OtherComponent (App.tsx:99:1)\n    at renderWithHooks (react-dom.js:1:1)';
    expect(errorFingerprint('boom', a)).not.toBe(errorFingerprint('boom', b));
  });

  it('ignores frames past the first — call depth should not fragment the dedupe key', () => {
    const a = 'Error: boom\n    at Bomb (App.tsx:10:5)\n    at renderWithHooks (react-dom.js:1:1)';
    const b = 'Error: boom\n    at Bomb (App.tsx:10:5)\n    at somethingElseEntirely (other.js:5:5)';
    expect(errorFingerprint('boom', a)).toBe(errorFingerprint('boom', b));
  });

  it('still produces a usable fingerprint with no stack at all', () => {
    // window.onerror and a rejection with a non-Error reason often have none.
    expect(errorFingerprint('boom', undefined)).toBe(errorFingerprint('boom', undefined));
    expect(() => errorFingerprint('boom', undefined)).not.toThrow();
  });
});
