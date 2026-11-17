import { sampleGrades } from "@/lib/grade";
import type { ActivitySample } from "@/lib/queries";

export interface SamplePoint {
	d: number; // cumulative distance, km
	t: number; // elapsed time, seconds
	hr: number | null;
	elevation: number | null;
	grade: number | null; // signed, percent
	lat?: number;
	lng?: number;
}

// Collapse the full-resolution samples down to a chart-sized series, keyed by
// distance. Thinning keeps recharts responsive on multi-thousand-point runs; the
// map polyline reads the same thinned points so a hovered index lines up on both.
// Grade is computed before thinning, so it still sees every altitude fix.
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
			lat: coords ? coords[1] : undefined,
			lng: coords ? coords[0] : undefined,
		});
	}
	const track = points.flatMap((p) =>
		p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng }] : [],
	);
	return { points, track, hasHr, hasElevation };
}
