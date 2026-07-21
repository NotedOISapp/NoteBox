/**
 * Adds calendar months to a UTC timestamp, preserving day-of-month where valid
 * and clamping to the target month's final day if the original day exceeds it.
 *
 * Requirements:
 * - Operates in UTC
 * - Immutability (does not modify input Date)
 * - Time-of-day preservation
 * - Clamps days (e.g. Jan 31 + 1 month = Feb 28/29)
 * - Rejects invalid dates or non-integer months
 */
export function addCalendarMonthsClamped(timestamp: Date, months: number): Date {
  if (!timestamp || !(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
    throw new Error('Invalid timestamp provided to addCalendarMonthsClamped');
  }

  if (typeof months !== 'number' || !Number.isInteger(months)) {
    throw new Error('Months parameter must be an integer');
  }

  const year = timestamp.getUTCFullYear();
  const month = timestamp.getUTCMonth(); // 0-indexed
  const day = timestamp.getUTCDate();
  const hours = timestamp.getUTCHours();
  const minutes = timestamp.getUTCMinutes();
  const seconds = timestamp.getUTCSeconds();
  const ms = timestamp.getUTCMilliseconds();

  // Calculate target month and year
  const totalMonths = month + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  let targetMonth = totalMonths % 12;
  if (targetMonth < 0) {
    targetMonth += 12;
  }

  // Determine number of days in target month (day 0 of targetMonth + 1)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay, hours, minutes, seconds, ms));
}
