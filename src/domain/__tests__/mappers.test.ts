// src/domain/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { meetingToExtracted } from '../mappers';
import type { ClassMeeting } from '../types';

function meeting(over: Partial<ClassMeeting> = {}): ClassMeeting {
  return {
    id: 'c1',
    name: 'BIO 101',
    instructor: 'Dr. Chen',
    room: 'H-421',
    courseCode: '101-BIO-AB',
    section: '00002',
    days: [1, 3, 5],
    startMinute: 600,
    endMinute: 650,
    color: 'indigo',
    ...over,
  };
}

describe('meetingToExtracted', () => {
  it('carries every editable field across', () => {
    expect(meetingToExtracted(meeting())).toEqual({
      name: 'BIO 101',
      instructor: 'Dr. Chen',
      room: 'H-421',
      courseCode: '101-BIO-AB',
      section: '00002',
      days: [1, 3, 5],
      startMinute: 600,
      endMinute: 650,
    });
  });

  it('drops id and color', () => {
    const result = meetingToExtracted(meeting());
    expect('id' in result).toBe(false);
    expect('color' in result).toBe(false);
  });

  it('preserves nulls in the optional fields', () => {
    const result = meetingToExtracted(
      meeting({ instructor: null, room: null, courseCode: null, section: null })
    );
    expect(result.instructor).toBeNull();
    expect(result.room).toBeNull();
    expect(result.courseCode).toBeNull();
    expect(result.section).toBeNull();
  });

  it('copies the days array rather than aliasing the source', () => {
    const source = meeting();
    const result = meetingToExtracted(source);
    expect(result.days).not.toBe(source.days);
    expect(result.days).toEqual(source.days);
  });
});
