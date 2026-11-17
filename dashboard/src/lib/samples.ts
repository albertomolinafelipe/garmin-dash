import { sampleGrades } from "@/lib/grade";
import type { ActivitySample } from "@/lib/queries";

export interface SamplePoint {
	d: number; // cumulative distance, km
	t: number; // elapsed time, seconds
	hr: number | null;
	elevation: number | null;
	grade: number | null; // signed, percent
	ascent: number; // metres climbed so far
	descent: number; // metres descended so far
	lat?: number;
	lng?: number;
}

// Altitude has to move this far from the last counted level before it counts,
// so barometer jitter is not summed into the total. 1.5 m lands the final
// ascent within a few percent of Garmin's elevation gain on our runs and hikes.
const CLIMB_THRESHOLD_M = 1.5;

// Running ascent and descent at every sample, with hysteresis: a change is
// counted only once it exceeds the threshold, measured from the last level
// where something was counted.
export function cumulativeClimb(
	altitude: (number | null)[],
	thresholdM = CLIMB_THRESHOLD_M,
): { ascent: number[]; descent: number[] } {
	const ascent: number[] = [];
	const descent: number[] = [];
	let up = 0;
	let down = 0;
	let ref: number | null = null;
	for (const z of altitude) {
		if (z != null) {
			if (ref == null) ref = z;
			else if (z - ref >= thresholdM) {
				up += z - ref;
				ref = z;
			} else if (ref - z >= thresholdM) {
				down += ref - z;
				ref = z;
			}
		}
		ascent.push(up);
		descent.push(down);
	}
	return { ascent, descent };
}

// Collapse the full-resolution samples down to a chart-sized series, keyed by
// distance. Thinning keeps recharts responsive on multi-thousand-point runs; the
// map polyline reads the same thinned points so a hovered index lines up on both.
// Grade and climb are computed before thinning, so they see every altitude fix.
export function buildSamplePoints(samples: ActivitySample[]): {
	points: SamplePoint[];
	track: { lat: number; lng: number }[];
	hasHr: boolean;
	hasElevation: boolean;
} {
	const MAX_POINTS = 700;
	const step = Math.max(1, Math.ceil(samples.length / MAX_POINTS));
	const grades = sampleGrades(
		samples.map((s) => (s.distance_m == null ? null : Number(s.distance_m))),
		samples.map((s) => (s.altitude_m == null ? null : Number(s.altitude_m))),
	);
	const climb = cumulativeClimb(
		samples.map((s) => (s.altitude_m == null ? null : Number(s.altitude_m))),
	);
	const points: SamplePoint[] = [];
	let hasHr = false;
	let hasElevation = false;
	for (let i = 0; i < samples.length; i += step) {
		const s = samples[i];
		const coords = s.geom?.coordinates;
		const elevation = s.altitude_m == null ? null : Number(s.altitude_m);
		if (s.hr != null) hasHr = true;
		if (elevation != null) hasElevation = true;
		points.push({
			d: Number(s.distance_m ?? 0) / 1000,
			t: Number(s.elapsed_s ?? 0),
			hr: s.hr ?? null,
			elevation,
			grade: grades[i],
			ascent: climb.ascent[i],
			descent: climb.descent[i],
			lat: coords ? coords[1] : undefined,
			lng: coords ? coords[0] : undefined,
		});
	}
	const track = points.flatMap((p) =>
		p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng }] : [],
	);
	return { points, track, hasHr, hasElevation };
}
