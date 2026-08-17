/** Fixed schedule grid window: 08:00–18:00, expressed as minutes from midnight. */
export const DAY_START_MINUTE = 480;
export const DAY_END_MINUTE = 1080;

/** Shortest gap that counts as usable mutual free time. */
export const MIN_FREE_MINUTES = 30;

/** ISO weekday numbers: 1 = Monday .. 7 = Sunday. */
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};

/** Single-letter labels for the mobile day-toggle chips. */
export const WEEKDAY_INITIALS: Record<number, string> = {
  1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S',
};

/**
 * Friends you can compare against at once, on top of yourself — so six lanes
 * at the widest. Past that the per-person lane on a 320px phone drops under
 * ~40px and the grid stops being readable at all.
 */
export const MAX_GROUP_FRIENDS = 5;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1600;

/**
 * OCR gets a larger budget than the upload path. Character recognition degrades
 * sharply as glyphs shrink, and these pixels never leave the device, so there is
 * no cellular cost to trade against.
 */
export const OCR_MAX_IMAGE_EDGE = 2600;
export const EXTRACTIONS_PER_HOUR = 10;
