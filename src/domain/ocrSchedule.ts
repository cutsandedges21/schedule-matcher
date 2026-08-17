// src/domain/ocrSchedule.ts
//
// Extracts a schedule from an Omnivox-style grid screenshot without an LLM.
//
// Why this exists alongside the Gemini path: a vision model has to *eyeball*
// where a block starts and stops, and measurably gets it wrong — it read a
// 10:30-12:00 class as 10:00-12:00. This module never estimates a time. It
// calibrates pixels-to-minutes from the grid's own printed time labels, finds
// each block's true extent from the cell background, and computes the time.
// It is also free, offline, and has no rate limit.
//
// The trade-off is rigidity: it assumes a weekday-column grid with a time
// gutter. When that assumption fails it reports low confidence and the caller
// falls back to the model, which handles unfamiliar layouts far better.

import Tesseract from 'tesseract.js';
import type { ExtractedClass } from './types';

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  classes: ExtractedClass[];
  warnings: string[];
  /** False when the image doesn't look like a grid we can measure. */
  recognized: boolean;
  /** Populated only to debug calibration and block detection. */
  debug?: Record<string, unknown>;
}

const DAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/**
 * Empty cells are painted a flat grey (measured: 238,238,238) while occupied
 * cells are white. Detecting the GREY is what matters: a row carrying class
 * text is only ~28% white, so testing for whiteness rejects precisely the rows
 * that hold the information. A row is occupied when it is mostly not-grey.
 */
const EMPTY_GREY_MIN = 228;
const EMPTY_GREY_MAX = 246;
const GREY_RATIO_THRESHOLD = 0.5;

/** Runs shorter than this are borders or noise, not classes. */
const MIN_BLOCK_PX = 24;
/** Gaps this small are cell borders inside one block, not a break between blocks. */
const MAX_BORDER_GAP_PX = 6;

/**
 * Two classes back to back are both white with only a rule between them, so
 * background alone cannot separate them. That rule is unmistakable though:
 * measured at 100% of the column width at ~221 brightness, with clean white one
 * pixel either side. Any row this dark right across the column ends a block.
 */
const SEPARATOR_MAX_BRIGHTNESS = 230;
const SEPARATOR_MIN_COVERAGE = 0.9;

const CODE_RE = /\b(\d{3}-[A-Z0-9]{3}-[A-Z]{2})\b/;
const SECTION_RE = /sec\.?\s*(\d+)/i;
const ROOM_RE = /\b([A-Z]-\d{3})\b/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Theil–Sen fit, then a least-squares refit on the inliers.
 *
 * Plain least squares is unusable here: OCR reliably drops the leading digit on
 * some gutter labels, reading "10:00" as "0:00" and "15:00" as "5:00". Four such
 * points out of twenty-two dragged the slope 20% off and corrupted every
 * extracted time. The median of pairwise slopes ignores them outright, and it
 * tolerates far more corruption than these images ever contain.
 */
function robustFit(points: { y: number; minutes: number }[]): {
  slope: number;
  intercept: number;
  inliers: number;
  outliers: number;
} | null {
  if (points.length < 4) return null;

  const slopes: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dy = points[j].y - points[i].y;
      if (Math.abs(dy) < 1) continue;
      slopes.push((points[j].minutes - points[i].minutes) / dy);
    }
  }
  if (slopes.length === 0) return null;

  const roughSlope = median(slopes);
  const roughIntercept = median(points.map((p) => p.minutes - roughSlope * p.y));

  // A label more than half a row off the trend is a misread, not a data point.
  const tolerance = 15;
  const inliers = points.filter(
    (p) => Math.abs(p.minutes - (roughSlope * p.y + roughIntercept)) <= tolerance
  );

  const outliers = points.length - inliers.length;
  if (inliers.length < 4) return { slope: roughSlope, intercept: roughIntercept, inliers: inliers.length, outliers };

  const refined = fitLinear(inliers);
  return { ...refined, inliers: inliers.length, outliers };
}

/** Least-squares fit of minutes = slope * y + intercept. */
function fitLinear(points: { y: number; minutes: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumM = points.reduce((a, p) => a + p.minutes, 0);
  const sumYY = points.reduce((a, p) => a + p.y * p.y, 0);
  const sumYM = points.reduce((a, p) => a + p.y * p.minutes, 0);
  const denominator = n * sumYY - sumY * sumY;
  if (denominator === 0) return { slope: 0, intercept: 0 };
  const slope = (n * sumYM - sumY * sumM) / denominator;
  return { slope, intercept: (sumM - slope * sumY) / n };
}

export function collectWords(data: unknown): OcrWord[] {
  const words: OcrWord[] = [];
  const push = (w: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }) => {
    if (w?.bbox && typeof w.text === 'string') {
      words.push({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
    }
  };
  const d = data as Record<string, any>;
  // v7 nests words under blocks; older versions expose a flat array.
  if (Array.isArray(d.words) && d.words.length) d.words.forEach(push);
  else {
    for (const block of d.blocks ?? [])
      for (const paragraph of block.paragraphs ?? [])
        for (const line of paragraph.lines ?? []) (line.words ?? []).forEach(push);
  }
  return words;
}

/** Day-name headers give the column centres, and so the column boundaries. */
function findDayColumns(words: OcrWord[]): { day: number; centerX: number }[] {
  const found: { day: number; centerX: number }[] = [];
  for (const word of words) {
    const index = DAY_NAMES.indexOf(word.text.trim().toLowerCase());
    if (index >= 0 && !found.some((f) => f.day === index + 1)) {
      found.push({ day: index + 1, centerX: (word.x0 + word.x1) / 2 });
    }
  }
  return found.sort((a, b) => a.centerX - b.centerX);
}

/**
 * Calibrates y-to-minutes from the gutter's printed labels. Each row prints its
 * start at the top and its end at the bottom, so for any given time there are
 * two labels; we keep the topmost, which is the one that marks a row boundary.
 */
function calibrateTime(
  words: OcrWord[],
  gutterMaxX: number,
  headerY: number
): {
  slope: number;
  intercept: number;
  labels: number;
  inliers: number;
  outliers: number;
  points: { y: number; minutes: number }[];
} | null {
  const byMinutes = new Map<number, number>();

  for (const word of words) {
    if (word.x1 > gutterMaxX) continue; // not in the left gutter
    if (word.y0 < headerY) continue; // above the grid (e.g. a status-bar clock)
    const match = TIME_RE.exec(word.text.trim());
    if (!match) continue;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    if (minutes < 0 || minutes > 1440) continue;
    const centerY = (word.y0 + word.y1) / 2;
    const existing = byMinutes.get(minutes);
    if (existing === undefined || centerY < existing) byMinutes.set(minutes, centerY);
  }

  if (byMinutes.size < 4) return null;
  const points = [...byMinutes].map(([minutes, y]) => ({ y, minutes })).sort((a, b) => a.y - b.y);
  const fit = robustFit(points);
  if (!fit || !Number.isFinite(fit.slope) || fit.slope <= 0) return null;
  return { ...fit, labels: points.length, points };
}

/**
 * Finds the vertical extent of each class block in a column by reading the cell
 * background: occupied cells are white, empty ones grey. This is the whole
 * point of the module — a real measurement rather than an estimate.
 */
function findBlocks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number
): { top: number; bottom: number }[] {
  const occupied: boolean[] = [];
  const separator: boolean[] = [];
  const sampleStep = Math.max(1, Math.floor((xEnd - xStart) / 40));

  for (let y = 0; y < height; y += 1) {
    if (y < yStart || y > yEnd) {
      occupied.push(false);
      separator.push(false);
      continue;
    }
    let grey = 0;
    let dark = 0;
    let total = 0;
    for (let x = xStart; x <= xEnd; x += sampleStep) {
      const i = (y * width + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      total += 1;
      const isNeutral = Math.abs(r - g) < 6 && Math.abs(g - b) < 6;
      if (isNeutral && r >= EMPTY_GREY_MIN && r <= EMPTY_GREY_MAX) grey += 1;
      if ((r + g + b) / 3 < SEPARATOR_MAX_BRIGHTNESS) dark += 1;
    }
    const isSeparator = total > 0 && dark / total >= SEPARATOR_MIN_COVERAGE;
    separator.push(isSeparator);
    occupied.push(total > 0 && !isSeparator && grey / total < GREY_RATIO_THRESHOLD);
  }

  const runs: { top: number; bottom: number }[] = [];
  let start: number | null = null;
  for (let y = 0; y < occupied.length; y += 1) {
    if (occupied[y] && start === null) start = y;
    if (!occupied[y] && start !== null) {
      runs.push({ top: start, bottom: y - 1 });
      start = null;
    }
  }
  if (start !== null) runs.push({ top: start, bottom: occupied.length - 1 });

  // Stitch runs split by a thin border, but never across a separator rule —
  // that rule is exactly what divides two back-to-back classes.
  const merged: { top: number; bottom: number }[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    const gapHasSeparator =
      last && separator.slice(last.bottom + 1, run.top).some(Boolean);
    if (last && !gapHasSeparator && run.top - last.bottom <= MAX_BORDER_GAP_PX) {
      last.bottom = run.bottom;
    } else {
      merged.push({ ...run });
    }
  }

  return merged.filter((r) => r.bottom - r.top >= MIN_BLOCK_PX);
}

/** Groups a block's words into visual lines, top to bottom. */
function toLines(words: OcrWord[]): string[] {
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const lines: OcrWord[][] = [];
  for (const word of sorted) {
    const line = lines[lines.length - 1];
    const lineY = line ? (line[0].y0 + line[0].y1) / 2 : 0;
    const wordY = (word.y0 + word.y1) / 2;
    if (line && Math.abs(wordY - lineY) < (word.y1 - word.y0) * 0.8) line.push(word);
    else lines.push([word]);
  }
  return lines.map((l) =>
    l.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim()
  );
}

function parseBlock(lines: string[]): Omit<ExtractedClass, 'days' | 'startMinute' | 'endMinute'> | null {
  if (lines.length === 0) return null;
  const joined = lines.join('\n');

  const code = CODE_RE.exec(joined)?.[1] ?? null;
  const section = SECTION_RE.exec(joined)?.[1] ?? null;
  const room = ROOM_RE.exec(joined)?.[1] ?? null;

  // The name is everything above the code line; if there's no code, the first line.
  const codeLineIndex = lines.findIndex((l) => CODE_RE.test(l));
  const nameLines = codeLineIndex > 0 ? lines.slice(0, codeLineIndex) : [lines[0]];
  const name = nameLines.join(' ').trim();
  if (!name) return null;

  // The instructor is a name-shaped line that isn't the code, the room, or the
  // delivery mode. "Classroom" alone is a delivery mode, never a person.
  const instructor =
    lines.find(
      (l, i) =>
        i > codeLineIndex &&
        !CODE_RE.test(l) &&
        !ROOM_RE.test(l) &&
        !/^(classroom|online|hybrid|distance)$/i.test(l.trim()) &&
        /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]{2,}/.test(l)
    ) ?? null;

  return { name, courseCode: code, section, room, instructor };
}

/**
 * Runs the whole pipeline against a canvas holding the screenshot at natural
 * resolution. Returns `recognized: false` when the image doesn't present a
 * measurable grid, which is the caller's signal to fall back to the model.
 */
export async function extractScheduleByOcr(canvas: HTMLCanvasElement): Promise<OcrResult> {
  const warnings: string[] = [];
  const worker = await Tesseract.createWorker('eng');
  let words: OcrWord[];
  try {
    const result = await worker.recognize(canvas, {}, { blocks: true });
    words = collectWords(result.data);
  } finally {
    await worker.terminate();
  }

  const columns = findDayColumns(words);
  if (columns.length < 3) {
    return { classes: [], warnings: ['Could not find weekday columns.'], recognized: false };
  }

  const headerY = Math.min(
    ...words
      .filter((w) => DAY_NAMES.includes(w.text.trim().toLowerCase()))
      .map((w) => w.y0)
  );
  const spacing = median(columns.slice(1).map((c, i) => c.centerX - columns[i].centerX));
  const gutterMaxX = columns[0].centerX - spacing / 2;

  const calibration = calibrateTime(words, gutterMaxX, headerY);
  if (!calibration) {
    return { classes: [], warnings: ['Could not read the time column.'], recognized: false };
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return { classes: [], warnings: ['Canvas unavailable.'], recognized: false };
  const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const minutesAt = (y: number) => calibration.slope * y + calibration.intercept;
  const snap = (m: number) => Math.round(m / 30) * 30;

  // Bound the scan to the table body using the calibrated time range, NOT the
  // header text. The page above the grid is also white, so scanning from the
  // header treats the heading area as one enormous occupied block and shifts
  // every detected start time upwards.
  const rowPx = 30 / calibration.slope;

  // Bound by the INLIER labels' pixel range. Using the raw label values would
  // reintroduce the misreads Theil-Sen just rejected — a "10:00" read as "0:00"
  // drags gridTop to the top of the page, where the white page background then
  // reads as one giant occupied block.
  const inlierYs = calibration.points
    .filter((p) => Math.abs(p.minutes - (calibration.slope * p.y + calibration.intercept)) <= 15)
    .map((p) => p.y);

  // Keep the scan below the weekday header row, or "Thursday" gets swallowed
  // into the first class block as part of its name.
  const headerBottom = Math.max(
    ...words.filter((w) => DAY_NAMES.includes(w.text.trim().toLowerCase())).map((w) => w.y1)
  );
  const gridTop = Math.max(
    Math.round(headerBottom + 4),
    Math.round(Math.min(...inlierYs) - rowPx * 0.5)
  );
  const gridBottom = Math.min(canvas.height - 1, Math.round(Math.max(...inlierYs) + rowPx * 0.5));

  const classes: ExtractedClass[] = [];

  for (const column of columns) {
    const half = spacing / 2;
    const xStart = Math.max(0, Math.round(column.centerX - half + 4));
    const xEnd = Math.min(canvas.width - 1, Math.round(column.centerX + half - 4));

    for (const block of findBlocks(pixels, canvas.width, canvas.height, xStart, xEnd, gridTop, gridBottom)) {
      const startMinute = snap(minutesAt(block.top));
      const endMinute = snap(minutesAt(block.bottom));
      if (endMinute <= startMinute) continue;

      const inBlock = words.filter((w) => {
        const cx = (w.x0 + w.x1) / 2;
        const cy = (w.y0 + w.y1) / 2;
        return cx >= xStart && cx <= xEnd && cy >= block.top && cy <= block.bottom;
      });
      if (inBlock.length === 0) continue;

      const parsed = parseBlock(toLines(inBlock));
      if (!parsed) continue;

      classes.push({ ...parsed, days: [column.day], startMinute, endMinute });
    }
  }

  const debug = {
    columns,
    spacing: Math.round(spacing),
    gutterMaxX: Math.round(gutterMaxX),
    headerY: Math.round(headerY),
    gridTop,
    gridBottom,
    rowPx: Math.round(rowPx * 10) / 10,
    calibration: {
      slope: Math.round(calibration.slope * 10000) / 10000,
      intercept: Math.round(calibration.intercept * 10) / 10,
      labels: calibration.labels,
      inliers: calibration.inliers,
      outliers: calibration.outliers,
    },
    checks: {
      minutesAtGridTop: Math.round(minutesAt(gridTop)),
      minutesAtGridBottom: Math.round(minutesAt(gridBottom)),
    },
  };

  if (classes.length === 0) {
    warnings.push('Found the grid but no class blocks in it.');
    return { classes, warnings, recognized: false, debug };
  }

  return { classes, warnings, recognized: true, debug };
}

/** Merges identical classes that meet at the same time on several days. */
export function mergeAcrossDays(classes: ExtractedClass[]): ExtractedClass[] {
  const groups = new Map<string, ExtractedClass>();
  for (const c of classes) {
    const key = [
      (c.courseCode ?? c.name).toLowerCase(),
      c.section ?? '',
      c.startMinute,
      c.endMinute,
      c.room ?? '',
    ].join('|');
    const existing = groups.get(key);
    if (existing) existing.days = [...new Set([...existing.days, ...c.days])].sort((a, b) => a - b);
    else groups.set(key, { ...c, days: [...c.days] });
  }
  return [...groups.values()].sort((a, b) => a.days[0] - b.days[0] || a.startMinute - b.startMinute);
}
