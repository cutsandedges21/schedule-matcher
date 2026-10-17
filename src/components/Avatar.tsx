// src/components/Avatar.tsx
import { CLASS_COLORS, colorForClass } from '@/domain/color';

/**
 * Initials on a tint picked by hashing the username — the same hash that
 * colours classes, so a student's dot is the same colour on every screen and
 * for every viewer. Full literal classes from CLASS_COLORS, never interpolated.
 */
export default function Avatar({
  username,
  size = 'md',
}: {
  username: string;
  size?: 'sm' | 'md';
}) {
  const palette = CLASS_COLORS[colorForClass(username)] ?? CLASS_COLORS.indigo;
  const initials = username.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
  const dimensions = size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-xs';

  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-bold ${dimensions} ${palette.block} ${palette.text}`}
    >
      {initials}
    </span>
  );
}
