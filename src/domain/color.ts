// src/domain/color.ts
import { normalizeClassName } from './text';

export const CLASS_PALETTE = [
  'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange',
] as const;

export type ClassColor = (typeof CLASS_PALETTE)[number];

export interface ClassColorStyles {
  block: string;
  text: string;
  accent: string;
}

/**
 * Full literal Tailwind classes — never build these by interpolation, the
 * JIT scanner cannot see interpolated names and the styles get dropped.
 */
export const CLASS_COLORS: Record<string, ClassColorStyles> = {
  indigo:  { block: 'bg-indigo-100 border-indigo-300',   text: 'text-indigo-900',  accent: 'bg-indigo-500' },
  emerald: { block: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-900', accent: 'bg-emerald-500' },
  amber:   { block: 'bg-amber-100 border-amber-300',     text: 'text-amber-900',   accent: 'bg-amber-500' },
  rose:    { block: 'bg-rose-100 border-rose-300',       text: 'text-rose-900',    accent: 'bg-rose-500' },
  sky:     { block: 'bg-sky-100 border-sky-300',         text: 'text-sky-900',     accent: 'bg-sky-500' },
  violet:  { block: 'bg-violet-100 border-violet-300',   text: 'text-violet-900',  accent: 'bg-violet-500' },
  teal:    { block: 'bg-teal-100 border-teal-300',       text: 'text-teal-900',    accent: 'bg-teal-500' },
  orange:  { block: 'bg-orange-100 border-orange-300',   text: 'text-orange-900',  accent: 'bg-orange-500' },
};

/**
 * Deterministic name → colour. Because it depends only on the name, the same
 * class gets the same colour for every student, which is what makes shared
 * classes visually obvious in the compare view with no coordination.
 */
export function colorForClass(name: string): ClassColor {
  const normalized = normalizeClassName(name);
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return CLASS_PALETTE[hash % CLASS_PALETTE.length];
}
