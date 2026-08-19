// src/domain/beta.ts

/**
 * Accounts that can pick a card colour, banner or effect while cosmetics are
 * in private beta. Everyone else sees Settings exactly as it was before they
 * existed.
 *
 * **This hides the picker. It does not stop the write.** `profiles_update`
 * still lets any authenticated student set `cosmetic`, `banner` and `effect`
 * on their own row, so anyone who opens devtools or calls PostgREST directly
 * can set one anyway. That is acceptable for a beta among four known accounts
 * and is *not* acceptable once cosmetics sit behind the paid Pass — at that
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
];

const NORMALISED = new Set(BETA_EMAILS.map((email) => email.toLowerCase()));

/**
 * Case-insensitive: Supabase stores what the identity provider sends, and
 * Google is happy to hand back a capitalised local part. Comparing raw would
 * lock a tester out of their own account on a technicality.
 */
export function canPickCosmetics(email: string | null | undefined): boolean {
  return email ? NORMALISED.has(email.trim().toLowerCase()) : false;
}
