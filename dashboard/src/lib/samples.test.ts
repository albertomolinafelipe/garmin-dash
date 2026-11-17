import { describe, expect, it } from "vitest";

import { cumulativeClimb } from "@/lib/samples";

describe("cumulativeClimb", () => {
	it("sums climbs and descents as they happen", () => {
		const { ascent, descent } = cumulativeClimb([100, 110, 120, 115, 105, 130]);
		expect(ascent).toEqual([0, 10, 20, 20, 20, 45]);
		expect(descent).toEqual([0, 0, 0, 5, 15, 15]);
	});

	it("ignores jitter below the threshold", () => {
		const { ascent, descent } = cumulativeClimb([100, 101, 100, 101, 100, 101]);
		expect(ascent.at(-1)).toBe(0);
		expect(descent.at(-1)).toBe(0);
	});

	it("counts a slow climb once it clears the threshold", () => {
		const { ascent } = cumulativeClimb([100, 100.5, 101, 101.5, 102, 102.5, 103]);
		expect(ascent.at(-1)).toBeCloseTo(3);
	});

	it("carries totals across missing altitude", () => {
		const { ascent } = cumulativeClimb([100, null, 110, null]);
		expect(ascent).toEqual([0, 0, 10, 10]);
	});
});
