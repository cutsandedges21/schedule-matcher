import { describe, expect, it } from 'vitest';
import { canPickCosmetics } from '../beta';

describe('canPickCosmetics', () => {
  it.each([
    'andreas.retsinas70@gmail.com',
    'schedulematcher.info@gmail.com',
    'sportsdude3133@gmail.com',
    'alicemuffin13@gmail.com',
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

  // Some testers are listed by user id instead of email. The id alone is
  // enough — their email can be anything, or missing.
  it.each([
    'someone.else@gmail.com',
    null,
    undefined,
  ])('lets a listed user id in with email %p', (email) => {
    expect(canPickCosmetics(email, 'dda1c1b5-6102-4538-9534-f5d080091b4b')).toBe(true);
  });

  it('still lets a listed email in when its id is not listed', () => {
    expect(
      canPickCosmetics('sportsdude3133@gmail.com', '7b0c6f9e-2d7c-4f61-9a39-1b9d5b3c2a10'),
    ).toBe(true);
  });

  it.each([
    null,
    undefined,
    '',
    '7b0c6f9e-2d7c-4f61-9a39-1b9d5b3c2a10',
    // near misses on the listed id
    'dda1c1b5-6102-4538-9534-f5d080091b4c',
    'dda1c1b5-6102-4538-9534',
    'dda1c1b5-6102-4538-9534-f5d080091b4b0',
  ])('keeps an unlisted email with user id %p out', (userId) => {
    expect(canPickCosmetics('someone.else@gmail.com', userId)).toBe(false);
  });
});
