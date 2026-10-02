import { describe, expect, it } from "vitest";

import { categoryColor } from "@/lib/activity-types";
import { dayMarker, PLAIN_R, radiusForKm } from "@/lib/day-marker";
import type { CalendarActivity } from "@/lib/queries";

function activity(a: Partial<CalendarActivity>): CalendarActivity {
	return {
		id: "1",
		name: null,
		activity_type: null,
		subtype: null,
		start_time: "2026-09-01T08:00:00Z",
		duration_s: null,
		distance_m: null,
		elevation_gain_m: null,
		start_lat: null,
		start_lng: null,
		feeling: null,
		effort: null,
		caffeine: null,
		focus: null,
		shoe_id: null,
		...a,
	};
}

describe("radiusForKm", () => {
	it("uses the standard radius without a distance", () => {
		expect(radiusForKm(0)).toBe(PLAIN_R);
	});

	it("grows with distance and then plateaus", () => {
		expect(radiusForKm(5)).toBeLessThan(radiusForKm(15));
		expect(radiusForKm(25)).toBe(radiusForKm(80));
	});
});

describe("dayMarker", () => {
	it("has no slices on a rest day", () => {
		expect(dayMarker([], categoryColor)).toEqual([]);
	});

	it("fills the dot with one sport's color", () => {
		expect(
			dayMarker(
				[activity({ activity_type: "strength_training", duration_s: 3600 })],
				categoryColor,
			),
		).toEqual([
			{
				key: "1",
				category: "strength",
				color: categoryColor.strength,
				share: 1,
				radius: PLAIN_R,
			},
		]);
	});

	it("takes its radius from the day's longest activity", () => {
		const slices = dayMarker(
			[
				activity({
					id: "run",
					activity_type: "running",
					start_time: "2026-09-01T07:00:00Z",
					duration_s: 3600,
					distance_m: 40000,
				}),
				activity({
					id: "climb",
					activity_type: "bouldering",
					start_time: "2026-09-01T18:00:00Z",
					duration_s: 3600,
				}),
			],
			categoryColor,
		);
		expect(slices.map((s) => s.category)).toEqual(["running", "climbing"]);
		// The climb carries no distance, but it shares the run's radius so the dot
		// stays a clean circle.
		expect(slices.map((s) => s.radius)).toEqual([
			radiusForKm(40),
			radiusForKm(40),
		]);
		expect(slices.map((s) => s.share)).toEqual([0.5, 0.5]);
	});

	it("orders wedges by sport, not by time of day", () => {
		const slices = dayMarker(
			[
				activity({
					id: "climb",
					activity_type: "bouldering",
					start_time: "2026-09-01T07:00:00Z",
				}),
				activity({
					id: "weights",
					activity_type: "strength_training",
					start_time: "2026-09-01T12:00:00Z",
				}),
				activity({
					id: "run",
					activity_type: "running",
					start_time: "2026-09-01T18:00:00Z",
				}),
			],
			categoryColor,
		);
		expect(slices.map((s) => s.key)).toEqual(["run", "climb", "weights"]);
	});

	it("angles each wedge by its duration", () => {
		const slices = dayMarker(
			[
				activity({
					id: "a",
					activity_type: "running",
					start_time: "2026-09-01T07:00:00Z",
					duration_s: 1800,
				}),
				activity({
					id: "b",
					activity_type: "bouldering",
					start_time: "2026-09-01T18:00:00Z",
					duration_s: 5400,
				}),
			],
			categoryColor,
		);
		expect(slices.map((s) => s.share)).toEqual([0.25, 0.75]);
	});

	it("keeps two runs as separate, staggered slices", () => {
		const slices = dayMarker(
			[
				activity({
					id: "long",
					activity_type: "running",
					start_time: "2026-09-01T18:00:00Z",
					duration_s: 600,
					distance_m: 15000,
				}),
				activity({
					id: "short",
					activity_type: "trail_running",
					start_time: "2026-09-01T07:00:00Z",
					duration_s: 600,
					distance_m: 5000,
				}),
			],
			categoryColor,
		);
		// Same sport, so they stay adjacent and fall back to chronological order.
		expect(slices.map((s) => s.key)).toEqual(["short", "long"]);
		expect(slices.map((s) => s.radius)).toEqual([
			radiusForKm(15),
			radiusForKm(15),
		]);
	});

	it("splits evenly when durations are missing", () => {
		const slices = dayMarker(
			[
				activity({ id: "a", activity_type: "running" }),
				activity({ id: "b", activity_type: "bouldering" }),
			],
			categoryColor,
		);
		expect(slices.map((s) => s.share)).toEqual([0.5, 0.5]);
	});
});
