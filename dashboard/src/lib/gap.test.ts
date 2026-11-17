import { describe, expect, it } from "vitest";

import { stravaFactor } from "@/lib/gap";

describe("stravaFactor", () => {
	it("returns the measured factors at their grades", () => {
		expect(stravaFactor(0)).toBe(1);
		expect(stravaFactor(10)).toBeCloseTo(1.459);
		expect(stravaFactor(-10)).toBeCloseTo(0.876);
	});

	it("interpolates between measured grades", () => {
		expect(stravaFactor(12.5)).toBeCloseTo((1.459 + 1.846) / 2);
	});

	it("caps beyond the measured range", () => {
		expect(stravaFactor(60)).toBeCloseTo(4.286);
		expect(stravaFactor(-60)).toBeCloseTo(2.096);
	});
});
