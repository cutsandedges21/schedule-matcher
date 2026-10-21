// src/domain/beta.ts

/**
 * Accounts that can pick a card colour, banner or effect while cosmetics are
 * in private beta. Everyone else sees Settings exactly as it was before they
 * existed.
 *
 * **This hides the picker. It does not stop the write.** `profiles_update`
 * still lets any authenticated student set `cosmetic`, `banner` and `effect`
 * on their own row, so anyone who opens devtools or calls PostgREST directly
 * can set one anyway. That is acceptable for a beta among a handful of known
 * accounts and is *not* acceptable once cosmetics sit behind the paid Pass — at that
 * point the column has to be locked server-side, which is the note in the
 * headers of migrations 0007 and 0008. Do not mistake this list for that.
 *
 * Rendering is deliberately not gated: if a tester sets a cosmetic, every
 * friend sees it whether or not they are on this list. Cosmetics that only the buyer
 * can see have near-zero value — being seen by other people is the entire
 * product — so gating the *display* would test the wrong thing.
 */
const BETA_EMAILS: readonly string[] = [
  'andreas.retsinas70@gmail.com',
  'schedulematcher.info@gmail.com',
  'sportsdude3133@gmail.com',
  'alicemuffin13@gmail.com',
];

/**
 * Testers let in by Supabase user id (`auth.users.id`) rather than email, for
 * when the id is what we were handed. An id never changes, so this is the
 * sturdier of the two lists.
 */
const BETA_USER_IDS: readonly string[] = [
  'dda1c1b5-6102-4538-9534-f5d080091b4b', // Bianca
];

const NORMALISED_EMAILS = new Set(BETA_EMAILS.map((email) => email.toLowerCase()));
const NORMALISED_IDS = new Set(BETA_USER_IDS.map((id) => id.toLowerCase()));

/**
 * In if either the email or the user id is listed.
 *
 * Case-insensitive: Supabase stores what the identity provider sends, and
 * Google is happy to hand back a capitalised local part. Comparing raw would
 * lock a tester out of their own account on a technicality.
 */
export function canPickCosmetics(
  email: string | null | undefined,
  userId?: string | null,
): boolean {
  if (userId && NORMALISED_IDS.has(userId.trim().toLowerCase())) return true;
  return email ? NORMALISED_EMAILS.has(email.trim().toLowerCase()) : false;
}
