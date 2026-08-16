// src/domain/__tests__/color.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeClassName } from '../text';
import { colorForClass, CLASS_PALETTE, CLASS_COLORS } from '../color';

describe('normalizeClassName', () => {
  it('collapses case, punctuation and whitespace', () => {
    expect(normalizeClassName('BIO 101')).toBe('bio 101');
    expect(normalizeClassName('  bio-101  ')).toBe('bio 101');
    expect(normalizeClassName('BIO_101')).toBe('bio 101');
    expect(normalizeClassName('Bio  101')).toBe('bio 101');
  });
});

describe('colorForClass', () => {
  it('is deterministic', () => {
    expect(colorForClass('BIO 101')).toBe(colorForClass('BIO 101'));
  });

  it('gives names that normalize the same the same colour', () => {
    expect(colorForClass('BIO 101')).toBe(colorForClass('bio-101'));
  });

  it('only ever returns a palette key that has styles defined', () => {
    for (const name of ['BIO 101', 'MATH 220', 'ENG 105', 'CHEM 1A', 'PSY 300', '']) {
      const key = colorForClass(name);
      expect(CLASS_PALETTE).toContain(key);
      expect(CLASS_COLORS[key]).toBeDefined();
    }
  });
});
