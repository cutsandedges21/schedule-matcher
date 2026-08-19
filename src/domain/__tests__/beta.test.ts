import { describe, expect, it } from 'vitest';
import { canPickCosmetics } from '../beta';

describe('canPickCosmetics', () => {
  it.each([
    'andreas.retsinas70@gmail.com',
    'schedulematcher.info@gmail.com',
    'sportsdude3133@gmail.com',
  ])('lets %s in', (email) => {
    expect(canPickCosmetics(email)).toBe(true);
  });

  // Supabase stores whatever the identity provider sends, and Google will
  // happily return a capitalised local part. Comparing raw would lock a tester
  // out of their own account.
  it('ignores case and surrounding whitespace', () => {
    expect(canPickCosmetics('  Schedulematcher.Info@Gmail.com ')).toBe(true);
  });

  it.each([
    null,
    undefined,
    '',
    'someone.else@gmail.com',
    'cutsandedges21@gmail.com',
    'rachel.retsinas@gmail.com',
  ])('keeps %p out', (email) => {
    expect(canPickCosmetics(email)).toBe(false);
  });

  // A near-miss on a listed address must not pass. Cheap to assert, and the
  // kind of thing a careless switch to `includes` or a prefix match would break.
  it.each([
    'schedulematcher.info@gmail.com.attacker.example',
    'notschedulematcher.info@gmail.com',
    'schedulematcher.info@gmail.co',
  ])('keeps the near-miss %s out', (email) => {
    expect(canPickCosmetics(email)).toBe(false);
  });
});
