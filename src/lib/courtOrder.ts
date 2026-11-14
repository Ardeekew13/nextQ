/**
 * Where a session's courts are sorted for display - the Overview tab's court grid, the
 * courts list, and the public spectator page all need the same order, so this is the
 * single source of truth rather than each query repeating its own `.sort()`.
 */

export interface OrderableCourt {
  /** Set once the organiser drags a court into a custom position (see reorderCourts).
   * Unset (or shared with another court, which shouldn't normally happen) falls back to
   * courtNumber, so courts display in their original order until someone reorders them. */
  displayOrder?: number | null;
  courtNumber: number;
}

export function sortCourtsForDisplay<T extends OrderableCourt>(courts: T[]): T[] {
  return [...courts].sort((a, b) => {
    const orderA = a.displayOrder ?? a.courtNumber;
    const orderB = b.displayOrder ?? b.courtNumber;
    return orderA !== orderB ? orderA - orderB : a.courtNumber - b.courtNumber;
  });
}
