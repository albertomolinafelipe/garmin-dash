import { describe, expect, it } from "vitest";

import {
	GRADE_BANDS,
	gradeBand,
	gradeRuns,
	profileStops,
	routeSegments,
	sampleGrades,
} from "@/lib/grade";

// A track sampled every `stepM` metres whose altitude follows `slope` (percent)
// per stretch.
function track(stretches: { metres: number; slope: number }[], stepM = 5) {
	const distance: number[] = [];
	const altitude: number[] = [];
	let d = 0;
	let z = 1000;
	for (const { metres, slope } of stretches) {
		for (let m = 0; m < metres; m += stepM) {
			distance.push(d);
			altitude.push(z);
			d += stepM;
			z += (stepM * slope) / 100;
		}
	}
	return { distance, altitude };
}

describe("gradeBand", () => {
	it("bands by steepness regardless of direction", () => {
		expect(gradeBand(0)).toBe(0);
		expect(gradeBand(2.9)).toBe(0);
		expect(gradeBand(3)).toBe(1);
		expect(gradeBand(-12)).toBe(2);
		expect(gradeBand(12)).toBe(2);
		expect(gradeBand(40)).toBe(GRADE_BANDS.length - 1);
	});
});

describe("sampleGrades", () => {
	it("recovers a constant slope", () => {
		const { distance, altitude } = track([{ metres: 500, slope: 10 }]);
		const grades = sampleGrades(distance, altitude);
		expect(grades[50]).toBeCloseTo(10);
	});

	it("is unknown where the window has no horizontal run", () => {
		const grades = sampleGrades([0, 0, 0, 0], [100, 101, 102, 103]);
		expect(grades).toEqual([null, null, null, null]);
	});

	it("skips samples missing altitude or distance", () => {
		const { distance, altitude } = track([{ metres: 300, slope: -6 }]);
		const withGaps: (number | null)[] = [...altitude];
		withGaps[30] = null;
		const grades = sampleGrades(distance, withGaps);
		expect(grades[30]).toBeNull();
		expect(grades[31]).toBeCloseTo(-6);
	});

	it("drops implausible spikes", () => {
		const grades = sampleGrades([0, 10, 20, 30, 40, 50], [0, 0, 0, 80, 80, 80]);
		expect(grades.every((grade) => grade === null || Math.abs(grade) <= 60)).toBe(
			true,
		);
	});
});

describe("gradeRuns", () => {
	const point = (d: number, grade: number | null) => ({ d, grade });

	it("splits where the band changes, sharing the boundary point", () => {
		const points = [
			point(0, 1),
			point(0.1, 1),
			point(0.2, 20),
			point(0.3, 20),
			point(0.4, 20),
		];
		expect(gradeRuns(points)).toEqual([
			{ band: 0, start: 0, end: 2 },
			{ band: 3, start: 2, end: 4 },
		]);
	});

	it("absorbs runs shorter than the minimum into the previous one", () => {
		const points = [
			point(0, 1),
			point(0.1, 1),
			point(0.11, 10),
			point(0.12, 1),
			point(0.3, 1),
		];
		expect(gradeRuns(points)).toEqual([{ band: 0, start: 0, end: 4 }]);
	});

	it("folds a blip into the terrain around it, not the run before", () => {
		// 1 km steep climb, then 1 km flat broken by a short 10% bump.
		const points = [
			...Array.from({ length: 100 }, (_, i) => point(i / 100, 30)),
			...Array.from({ length: 101 }, (_, i) =>
				point(1 + i / 100, i >= 40 && i < 42 ? 10 : 1),
			),
		];
		expect(gradeRuns(points, 0.3).map((run) => run.band)).toEqual([4, 0]);
	});

	it("merges a short run into the neighbour with the closer band", () => {
		const points = [
			point(0, 1),
			point(0.5, 1),
			point(1, 4),
			point(1.02, 30),
			point(1.5, 30),
		];
		expect(gradeRuns(points, 0.1).map((run) => run.band)).toEqual([0, 4]);
	});

	it("keeps the current colour through unknown grades", () => {
		const points = [point(0, 20), point(0.1, null), point(0.2, 20)];
		expect(gradeRuns(points)).toEqual([{ band: 3, start: 0, end: 2 }]);
	});
});

describe("routeSegments", () => {
	it("colours each run and skips points without a fix", () => {
		const points = [
			{ lat: 1, lng: 1 },
			{},
			{ lat: 2, lng: 2 },
			{ lat: 3, lng: 3 },
		];
		const segments = routeSegments(points, [
			{ band: 0, start: 0, end: 2 },
			{ band: 5, start: 2, end: 3 },
		]);
		expect(segments).toEqual([
			{
				color: GRADE_BANDS[0].color,
				positions: [
					{ lat: 1, lng: 1 },
					{ lat: 2, lng: 2 },
				],
			},
			{
				color: GRADE_BANDS[5].color,
				positions: [
					{ lat: 2, lng: 2 },
					{ lat: 3, lng: 3 },
				],
			},
		]);
	});
});

describe("profileStops", () => {
	// 1 km flat then 1 km at 20%, one point every 10 m.
	const points = Array.from({ length: 201 }, (_, i) => ({
		d: i / 100,
		grade: i < 100 ? 1 : 20,
	}));

	it("keeps each stretch solid and blends only across the boundary", () => {
		const stops = profileStops(points);
		expect(stops.map((stop) => stop.color)).toEqual([
			GRADE_BANDS[0].color,
			GRADE_BANDS[0].color,
			GRADE_BANDS[3].color,
			GRADE_BANDS[3].color,
		]);
		// 200 m blend centred on the 1 km boundary.
		expect(stops[1].offset).toBeCloseTo(0.45);
		expect(stops[2].offset).toBeCloseTo(0.55);
	});

	it("is empty for a track with no length", () => {
		expect(profileStops([{ d: 0, grade: 5 }])).toEqual([]);
	});
});
