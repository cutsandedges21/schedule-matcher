// src/features/theme/SchoolChip.tsx
import { DEFAULT_SCHOOL_ID, schoolById } from '@/domain/schools';

/**
 * Another student's school, in *their* colours — hence inline styles rather
 * than the `accent` classes, which hold the *viewer's* school. Viewing a
 * Dawson friend's schedule must not repaint your app blue: that would make
 * "whose screen am I on" genuinely ambiguous.
 *
 * Renders nothing for a student who has not picked one, and nothing for an id
 * we no longer ship — an empty space says less wrong than a wrong college.
 */
export default function SchoolChip({ school }: { school: string | null }) {
  if (!school || school === DEFAULT_SCHOOL_ID) return null;

  const found = schoolById(school);
  if (found.id === DEFAULT_SCHOOL_ID) return null;

  return (
    <span
      // `self-start` matters: the chip's parent on a profile card is a flex
      // column, and a flex child stretches to the full width of the column by
      // default. Without it the "pill" is a full-width bar reaching the far
      // edge of the card. `inline-flex` alone does not save it — an inline-flex
      // element used as a flex item is still stretched by align-items.
      className="inline-flex self-start items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: found.accentSoft, color: found.accentStrong }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: found.accent }}
      />
      {found.name}
    </span>
  );
}
