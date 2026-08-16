// src/domain/__tests__/schema.test.ts
import { describe, it, expect } from 'vitest';
import { extractedClassSchema, extractionResponseSchema, usernameSchema } from '../schema';

const valid = {
  name: 'BIO 101',
  instructor: 'Dr. Reyes',
  room: 'SCI 204',
  courseCode: '420-SF3-RE',
  section: '00001',
  days: [1, 3, 5],
  startMinute: 600,
  endMinute: 650,
};

describe('extractedClassSchema', () => {
  it('accepts a well-formed class', () => {
    expect(extractedClassSchema.parse(valid)).toEqual(valid);
  });

  it('defaults missing optional fields to null', () => {
    const parsed = extractedClassSchema.parse({
      ...valid,
      instructor: undefined,
      room: undefined,
      courseCode: undefined,
      section: undefined,
    });
    expect(parsed.instructor).toBeNull();
    expect(parsed.room).toBeNull();
    expect(parsed.courseCode).toBeNull();
    expect(parsed.section).toBeNull();
  });

  it('rejects an end time at or before the start', () => {
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 600 })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 599 })).toThrow();
  });

  it('rejects an empty name and empty days', () => {
    expect(() => extractedClassSchema.parse({ ...valid, name: '' })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, days: [] })).toThrow();
  });

  it('rejects out-of-range weekdays and minutes', () => {
    expect(() => extractedClassSchema.parse({ ...valid, days: [0] })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, days: [8] })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, startMinute: -1 })).toThrow();
    expect(() => extractedClassSchema.parse({ ...valid, endMinute: 1441 })).toThrow();
  });
});

describe('extractionResponseSchema', () => {
  it('accepts an empty result', () => {
    expect(extractionResponseSchema.parse({ classes: [], warnings: [] })).toEqual({
      classes: [], warnings: [],
    });
  });

  it('defaults warnings to an empty array', () => {
    expect(extractionResponseSchema.parse({ classes: [] }).warnings).toEqual([]);
  });
});

describe('usernameSchema', () => {
  it('accepts lowercase handles', () => {
    expect(usernameSchema.parse('moss_b21')).toBe('moss_b21');
  });

  it('rejects handles that are too short, too long, or wrongly cased', () => {
    expect(() => usernameSchema.parse('ab')).toThrow();
    expect(() => usernameSchema.parse('a'.repeat(21))).toThrow();
    expect(() => usernameSchema.parse('MossB')).toThrow();
    expect(() => usernameSchema.parse('moss b')).toThrow();
  });
});
