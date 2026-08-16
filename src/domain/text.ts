// src/domain/text.ts

/** Lowercases and collapses punctuation so "BIO-101" and "bio 101" compare equal. */
export function normalizeClassName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
