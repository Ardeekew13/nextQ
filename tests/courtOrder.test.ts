import { describe, expect, it } from "vitest";
import { sortCourtsForDisplay } from "@/lib/courtOrder";

describe("sortCourtsForDisplay", () => {
  it("falls back to courtNumber order when no court has a displayOrder set (pre-reorder sessions)", () => {
    const courts = [{ courtNumber: 3 }, { courtNumber: 1 }, { courtNumber: 2 }];
    expect(sortCourtsForDisplay(courts).map((c) => c.courtNumber)).toEqual([1, 2, 3]);
  });

  it("uses displayOrder once the organiser has dragged at least once, overriding courtNumber order", () => {
    const courts = [
      { courtNumber: 1, displayOrder: 2 },
      { courtNumber: 2, displayOrder: 0 },
      { courtNumber: 3, displayOrder: 1 },
    ];
    expect(sortCourtsForDisplay(courts).map((c) => c.courtNumber)).toEqual([2, 3, 1]);
  });

  it("breaks a tie on equal displayOrder (shouldn't normally happen) by courtNumber", () => {
    const courts = [
      { courtNumber: 5, displayOrder: 0 },
      { courtNumber: 2, displayOrder: 0 },
    ];
    expect(sortCourtsForDisplay(courts).map((c) => c.courtNumber)).toEqual([2, 5]);
  });

  it("does not mutate the input array", () => {
    const courts = [{ courtNumber: 2 }, { courtNumber: 1 }];
    const copy = [...courts];
    sortCourtsForDisplay(courts);
    expect(courts).toEqual(copy);
  });
});
