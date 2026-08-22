// src/domain/__tests__/scheduleEdit.test.ts
import { describe, it, expect } from 'vitest';
import { hasUnsavedChanges } from '../scheduleEdit';
import type { ExtractedClass } from '../types';

function draft(over: Partial<ExtractedClass> = {}): ExtractedClass {
  return {
    name: 'BIO 101',
    instructor: 'Dr. Chen',
    room: 'H-421',
    courseCode: '101-BIO-AB',
    section: '00002',
    days: [1, 3, 5],
    startMinute: 600,
    endMinute: 650,
    ...over,
  };
}

describe('hasUnsavedChanges', () => {
  it('is false for two empty lists', () => {
    expect(hasUnsavedChanges([], [])).toBe(false);
  });

  it('is false for identical lists', () => {
    expect(hasUnsavedChanges([draft()], [draft()])).toBe(false);
  });

  it('detects a renamed class', () => {
    expect(hasUnsavedChanges([draft({ name: 'BIO 102' })], [draft()])).toBe(true);
  });

  it('detects a changed start time', () => {
    expect(hasUnsavedChanges([draft({ startMinute: 610 })], [draft()])).toBe(true);
  });

  it('detects a changed end time', () => {
    expect(hasUnsavedChanges([draft({ endMinute: 700 })], [draft()])).toBe(true);
  });

  it('detects an added day', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3, 5, 6] })], [draft()])).toBe(true);
  });

  it('detects a removed day', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3] })], [draft()])).toBe(true);
  });

  it('detects a swapped day at the same count', () => {
    expect(hasUnsavedChanges([draft({ days: [1, 3, 4] })], [draft()])).toBe(true);
  });

  it('detects a changed optional field', () => {
    expect(hasUnsavedChanges([draft({ room: 'H-999' })], [draft()])).toBe(true);
  });

  it('detects an optional field cleared to null', () => {
    expect(hasUnsavedChanges([draft({ instructor: null })], [draft()])).toBe(true);
  });

  it('detects an added class', () => {
    expect(hasUnsavedChanges([draft(), draft({ name: 'MATH 220' })], [draft()])).toBe(true);
  });

  it('detects a removed class', () => {
    expect(hasUnsavedChanges([], [draft()])).toBe(true);
  });

  it('detects a reordered list at the same length', () => {
    const a = draft();
    const b = draft({ name: 'MATH 220' });
    expect(hasUnsavedChanges([b, a], [a, b])).toBe(true);
  });
});
