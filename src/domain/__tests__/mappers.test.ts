// src/domain/__tests__/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { extractedToPreviewMeetings, meetingToExtracted } from '../mappers';
import { colorForClass } from '../color';
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

describe('extractedToPreviewMeetings', () => {
  it('returns an empty list for an empty draft', () => {
    expect(extractedToPreviewMeetings([])).toEqual([]);
  });

  it('assigns the same colour the class will have once saved', () => {
    const [preview] = extractedToPreviewMeetings([meetingToExtracted(meeting())]);
    expect(preview.color).toBe(colorForClass('BIO 101'));
  });

  it('recolours when the name changes, matching post-save colour', () => {
    const draft = { ...meetingToExtracted(meeting()), name: 'MATH 220' };
    const [preview] = extractedToPreviewMeetings([draft]);
    expect(preview.color).toBe(colorForClass('MATH 220'));
  });

  it('gives every entry a distinct id so React keys do not collide', () => {
    const draft = meetingToExtracted(meeting());
    const previews = extractedToPreviewMeetings([draft, draft, draft]);
    expect(new Set(previews.map((p) => p.id)).size).toBe(3);
  });

  it('round-trips a saved class back to the same displayed values', () => {
    const source = meeting();
    const [preview] = extractedToPreviewMeetings([meetingToExtracted(source)]);
    expect(preview.name).toBe(source.name);
    expect(preview.instructor).toBe(source.instructor);
    expect(preview.room).toBe(source.room);
    expect(preview.courseCode).toBe(source.courseCode);
    expect(preview.section).toBe(source.section);
    expect(preview.days).toEqual(source.days);
    expect(preview.startMinute).toBe(source.startMinute);
    expect(preview.endMinute).toBe(source.endMinute);
  });
});
