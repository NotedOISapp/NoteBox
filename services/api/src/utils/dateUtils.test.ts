import { describe, it, expect } from 'vitest';
import { addCalendarMonthsClamped } from './dateUtils.js';

describe('addCalendarMonthsClamped', () => {
  it('should add months preserving day when valid (Jan 10 + 3m -> Apr 10)', () => {
    const start = new Date('2026-01-10T14:30:00.000Z');
    const result = addCalendarMonthsClamped(start, 3);
    expect(result.toISOString()).toBe('2026-04-10T14:30:00.000Z');
  });

  it('should clamp days when target month has fewer days (Jan 31 + 1m -> Feb 28 in 2026)', () => {
    const start = new Date('2026-01-31T00:00:00.000Z');
    const result = addCalendarMonthsClamped(start, 1);
    expect(result.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('should handle leap year clamping correctly (Feb 29, 2028 + 12m -> Feb 28, 2029)', () => {
    const start = new Date('2028-02-29T12:00:00.000Z');
    const result = addCalendarMonthsClamped(start, 12);
    expect(result.toISOString()).toBe('2029-02-28T12:00:00.000Z');
  });

  it('should clamp November 30 + 3m -> Feb 28 in non-leap year', () => {
    const start = new Date('2026-11-30T08:15:30.500Z');
    const result = addCalendarMonthsClamped(start, 3);
    expect(result.toISOString()).toBe('2027-02-28T08:15:30.500Z');
  });

  it('should preserve input immutability', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const originalTime = start.getTime();
    addCalendarMonthsClamped(start, 6);
    expect(start.getTime()).toBe(originalTime);
  });

  it('should throw error for invalid timestamp or non-integer months', () => {
    expect(() => addCalendarMonthsClamped(new Date('invalid'), 3)).toThrow();
    expect(() => addCalendarMonthsClamped(new Date(), 1.5)).toThrow();
  });
});
