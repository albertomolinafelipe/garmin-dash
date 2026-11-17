import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { graphQLClient } from "@/graphql/client";

// Grade adjustment factors: the pace on a slope that costs the same effort as a
// given pace on the flat, as a multiple of it. 1.5 at +10% means a 5:00/km flat
// effort runs at 7:30/km up that grade.

// One row of the personal curve, materialized by the gap_curve view from this
// athlete's own runs (see its migration for the method).
export interface GapCurvePoint {
	grade_pct: number;
	factor: number | string;
	windows: number;
	activities: number;
}

const GAP_CURVE = `
	query GapCurve {
		gap_curve(order_by: { grade_pct: asc }) {
			grade_pct
			factor
			windows
			activities
		}
	}
`;

export function useGapCurve(): UseQueryResult<
	{ gap_curve: GapCurvePoint[] },
	Error
> {
	return useQuery({
		queryKey: ["gap-curve"],
		queryFn: () =>
			graphQLClient.request<{ gap_curve: GapCurvePoint[] }>(GAP_CURVE),
	});
}

// Strava's equal-heart-rate GAP (2017 model), as measured by Aaron Schroeder by
// uploading constant-grade synthetic runs: specialsauce/sources/strava.py.
// Keyed by grade in percent; linear in between.
const STRAVA_FACTORS: [number, number][] = [
	[-45, 2.096],
	[-30, 1.495],
	[-25, 1.273],
	[-20, 1.081],
	[-15, 0.941],
	[-10, 0.876],
	[-8, 0.876],
	[-6, 0.891],
	[-4, 0.918],
	[-2, 0.96],
	[0, 1],
	[2, 1.055],
	[4, 1.135],
	[6, 1.228],
	[8, 1.337],
	[10, 1.459],
	[15, 1.846],
	[20, 2.297],
	[25, 2.727],
	[30, 3.158],
	[45, 4.286],
];

export function stravaFactor(gradePct: number): number {
	const g = Math.min(45, Math.max(-45, gradePct));
	for (let i = 1; i < STRAVA_FACTORS.length; i++) {
		const [g1, f1] = STRAVA_FACTORS[i];
		if (g <= g1) {
			const [g0, f0] = STRAVA_FACTORS[i - 1];
			return f0 + ((f1 - f0) * (g - g0)) / (g1 - g0);
		}
	}
	return STRAVA_FACTORS[STRAVA_FACTORS.length - 1][1];
}
