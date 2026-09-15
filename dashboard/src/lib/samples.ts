import type { ActivitySample } from "@/lib/queries";

export interface SamplePoint {
	d: number; // cumulative distance, km
	hr: number | null;
	elevation: number | null;
	lat?: number;
	lng?: number;
}

// Collapse the full-resolution samples down to a chart-sized series, keyed by
// distance. Thinning keeps recharts responsive on multi-thousand-point runs; the
// map polyline reads the same thinned points so a hovered index lines up on both.
export function buildSamplePoints(samples: ActivitySample[]): {
	points: SamplePoint[];
	track: { lat: number; lng: number }[];
	hasHr: boolean;
	hasElevation: boolean;
} {
	const MAX_POINTS = 700;
	const step = Math.max(1, Math.ceil(samples.length / MAX_POINTS));
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
			hr: s.hr ?? null,
			elevation,
			lat: coords ? coords[1] : undefined,
			lng: coords ? coords[0] : undefined,
		});
	}
	const track = points.flatMap((p) =>
		p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng }] : [],
	);
	return { points, track, hasHr, hasElevation };
}
