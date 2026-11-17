// Route steepness, derived from the full-resolution samples in the browser so
// the window and thresholds can be tuned without touching the database.

// Rise over run is measured across this many metres of track, centred on the
// sample. Altitude jitters by a metre or two between consecutive fixes, so a
// point-to-point grade is noise; 50 m smooths that without hiding short climbs.
export const GRADE_WINDOW_M = 50;

// Below this much horizontal distance inside the window (stopped, or a GPS gap)
// the grade is unknown rather than a division by almost nothing.
const MIN_RUN_M = GRADE_WINDOW_M / 2;

// Grades outside this are GPS or barometer glitches, not terrain anyone ran.
const MAX_GRADE = 60;

// Steepness bands by absolute grade, flat to steep. The thresholds match the
// database's grade_band(), so a band here means the same thing as a band there.
export const GRADE_BANDS = [
	{ min: 0, label: "<3%", color: "#7E9CD8" }, // crystalBlue
	{ min: 3, label: "3–8%", color: "#7AA89F" }, // waveAqua2
	{ min: 8, label: "8–15%", color: "#E6C384" }, // carpYellow
	{ min: 15, label: "15–25%", color: "#FFA066" }, // surimiOrange
	{ min: 25, label: "25–35%", color: "#FF5D62" }, // peachRed
	{ min: 35, label: "35%+", color: "#C34043" }, // autumnRed
] as const;

export function gradeBand(grade: number): number {
	const steepness = Math.abs(grade);
	let band = 0;
	for (let i = 1; i < GRADE_BANDS.length; i++) {
		if (steepness >= GRADE_BANDS[i].min) band = i;
	}
	return band;
}

// Signed grade in percent for every sample, or null where it cannot be known.
// Distance is cumulative, so the window edges only ever move forward and the
// whole track is covered in one pass.
export function sampleGrades(
	distance: (number | null)[],
	altitude: (number | null)[],
	windowM = GRADE_WINDOW_M,
): (number | null)[] {
	const valid: number[] = [];
	for (let i = 0; i < distance.length; i++) {
		if (distance[i] != null && altitude[i] != null) valid.push(i);
	}
	const grades: (number | null)[] = distance.map(() => null);
	const half = windowM / 2;
	let lo = 0;
	let hi = 0;
	for (let k = 0; k < valid.length; k++) {
		const d = distance[valid[k]] as number;
		while (lo < k && (distance[valid[lo]] as number) < d - half) lo++;
		if (hi < k) hi = k;
		while (
			hi + 1 < valid.length &&
			(distance[valid[hi + 1]] as number) <= d + half
		)
			hi++;
		const run = (distance[valid[hi]] as number) - (distance[valid[lo]] as number);
		if (run < MIN_RUN_M) continue;
		const rise =
			(altitude[valid[hi]] as number) - (altitude[valid[lo]] as number);
		const grade = (rise / run) * 100;
		if (Math.abs(grade) <= MAX_GRADE) grades[valid[k]] = grade;
	}
	return grades;
}

// A stretch of the thinned series drawn in one colour. `end` is the next run's
// `start`, so consecutive polylines share an endpoint and leave no gap.
export interface GradeRun {
	band: number;
	start: number;
	end: number;
}

// Group points into runs of one band. Runs shorter than `minKm` are folded into
// a neighbour: a grade hovering on a threshold would otherwise flicker between
// two colours every few metres. The shortest offender goes first, into the
// neighbour whose band is closest to its own, so flicker is absorbed by the
// terrain around it rather than by whatever happened to come before.
export function gradeRuns(
	points: { d: number; grade: number | null }[],
	minKm = 0.04,
): GradeRun[] {
	if (points.length < 2) return [];
	const runs: GradeRun[] = [];
	let band = 0;
	for (let i = 0; i < points.length; i++) {
		const grade = points[i].grade;
		// Unknown grade keeps the colour it is already in.
		if (grade != null) band = gradeBand(grade);
		const last = runs.at(-1);
		if (last && last.band === band) last.end = i;
		else {
			if (last) last.end = i;
			runs.push({ band, start: i, end: i });
		}
	}
	runs[runs.length - 1].end = points.length - 1;

	const length = (run: GradeRun) => points[run.end].d - points[run.start].d;
	while (runs.length > 1) {
		let shortest = -1;
		for (let i = 0; i < runs.length; i++) {
			if (
				length(runs[i]) < minKm &&
				(shortest < 0 || length(runs[i]) < length(runs[shortest]))
			)
				shortest = i;
		}
		if (shortest < 0) break;
		const run = runs[shortest];
		const before = runs[shortest - 1];
		const after = runs[shortest + 1];
		const intoBefore =
			!after ||
			(before &&
				(Math.abs(before.band - run.band) < Math.abs(after.band - run.band) ||
					(Math.abs(before.band - run.band) ===
						Math.abs(after.band - run.band) &&
						length(before) >= length(after))));
		if (intoBefore) {
			before.end = run.end;
			runs.splice(shortest, 1);
			// The merge can leave two runs of one band side by side.
			if (after && after.band === before.band) {
				before.end = after.end;
				runs.splice(shortest, 1);
			}
		} else {
			after.start = run.start;
			runs.splice(shortest, 1);
			if (before && before.band === after.band) {
				before.end = after.end;
				runs.splice(shortest, 1);
			}
		}
	}
	return runs.filter((run) => run.end > run.start);
}

// Colour stops for the elevation profile, as fractions of its distance axis.
// The map can afford 40 m stretches, but on a chart a few pixels per hundred
// metres they read as a barcode. So the profile folds the same grades into
// longer stretches, keeps each one solid through its middle, and blends only
// across the boundaries, over at most `blendKm`.
export function profileStops(
	points: { d: number; grade: number | null }[],
	minKm = 0.3,
	blendKm = 0.2,
): { offset: number; color: string }[] {
	const first = points[0]?.d ?? 0;
	const span = (points.at(-1)?.d ?? 0) - first;
	if (span <= 0) return [];
	const offset = (d: number) => (d - first) / span;
	return gradeRuns(points, minKm).flatMap((run) => {
		const start = points[run.start].d;
		const end = points[run.end].d;
		const inset = Math.min(blendKm / 2, (end - start) / 2);
		const color = GRADE_BANDS[run.band].color;
		return [
			{ offset: offset(start + inset), color },
			{ offset: offset(end - inset), color },
		];
	});
}

export interface RouteSegment {
	color: string;
	positions: { lat: number; lng: number }[];
}

// One coloured polyline per run, for the maps. Points without a fix are skipped.
export function routeSegments(
	points: { lat?: number; lng?: number }[],
	runs: GradeRun[],
): RouteSegment[] {
	return runs.flatMap((run) => {
		const positions = points
			.slice(run.start, run.end + 1)
			.flatMap((p) =>
				p.lat != null && p.lng != null ? [{ lat: p.lat, lng: p.lng }] : [],
			);
		return positions.length > 1
			? [{ color: GRADE_BANDS[run.band].color, positions }]
			: [];
	});
}
