// src/domain/__tests__/errorReportGate.test.ts
import { describe, it, expect } from 'vitest';
import { createErrorReportGate, shouldReport } from '../errorReportGate';

describe('shouldReport', () => {
  it('allows the first sighting of a new fingerprint', () => {
    const gate = createErrorReportGate();
    expect(shouldReport(gate, 'a')).toBe(true);
  });

  it('drops a repeat of a fingerprint already reported this session', () => {
    const gate = createErrorReportGate();
    shouldReport(gate, 'a');
    expect(shouldReport(gate, 'a')).toBe(false);
  });

  it('allows up to 5 distinct fingerprints, then drops the rest', () => {
    const gate = createErrorReportGate();
    expect(shouldReport(gate, 'a')).toBe(true);
    expect(shouldReport(gate, 'b')).toBe(true);
    expect(shouldReport(gate, 'c')).toBe(true);
    expect(shouldReport(gate, 'd')).toBe(true);
    expect(shouldReport(gate, 'e')).toBe(true);
    // 6th distinct error this session — a broken student must not fill the table.
    expect(shouldReport(gate, 'f')).toBe(false);
  });

  it('keeps dropping the same repeated fingerprint even inside a tight loop', () => {
    const gate = createErrorReportGate();
    shouldReport(gate, 'loop');
    for (let i = 0; i < 1000; i += 1) {
      expect(shouldReport(gate, 'loop')).toBe(false);
    }
  });

  it('is scoped to one gate instance — a fresh gate (a fresh page load) starts clean', () => {
    const first = createErrorReportGate();
    shouldReport(first, 'a');

    const second = createErrorReportGate();
    expect(shouldReport(second, 'a')).toBe(true);
  });
});
