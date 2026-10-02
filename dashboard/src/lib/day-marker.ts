import {
	type Category,
	CATEGORY_ORDER,
	categoryOf,
} from "@/lib/activity-types";
import { type CalendarActivity, num } from "@/lib/queries";

// Geometry for the month panel's per-day dot. All numbers are in the 100x100
// viewBox units of the cell's SVG, so the marker scales with the panel.
export const VIEWBOX = 100;

// Distance-less sports (climbing, strength, …) always get this radius; distance
// sports are sized between MIN_R and MAX_R.
export const PLAIN_R = 18;
const MIN_R = 11;
const MAX_R = 44;

// Distance at which a slice reaches MAX_R. Above it the radius stops growing, so
// one long day cannot flatten the rest of the month.
const REF_KM = 25;

// Area grows linearly with distance (radius with its square root), which is how
// the eye compares circles.
export function radiusForKm(km: number): number {
	if (!(km > 0)) return PLAIN_R;
	return MIN_R + (MAX_R - MIN_R) * Math.sqrt(Math.min(km, REF_KM) / REF_KM);
}

export interface DaySlice {
	key: string;
	category: Category;
	color: string;
	/** Share of the turn, in [0, 1], proportional to the activity's duration. */
	share: number;
	/** The day's radius, shared by every wedge. */
	radius: number;
}

// One wedge per activity, angled by duration, on a dot whose radius comes from
// the day's longest distance. Repeats of the same sport stay separate wedges
// rather than merging.
//
// Wedges run clockwise from 12 o'clock in CATEGORY_ORDER — running, then
// climbing, and so on — rather than chronologically, so a colour always sits in
// the same place and the month can be scanned sport by sport.
export function dayMarker(
	activities: CalendarActivity[],
	colorOf: Record<Category, string>,
): DaySlice[] {
	if (activities.length === 0) return [];

	const ordered = activities
		.map((a) => ({ a, category: categoryOf(a.activity_type, a.subtype) }))
		.sort(
			(x, y) =>
				CATEGORY_ORDER.indexOf(x.category) -
					CATEGORY_ORDER.indexOf(y.category) ||
				(x.a.start_time ?? "").localeCompare(y.a.start_time ?? ""),
		);
	const total = ordered.reduce((sum, { a }) => sum + num(a.duration_s), 0);
	// A single radius per day keeps the dot a clean circle; the longest activity
	// sets it, so a big day still reads big.
	const radius = ordered.reduce(
		(max, { a }) => Math.max(max, radiusForKm(num(a.distance_m) / 1000)),
		0,
	);
	return ordered.map(({ a, category }) => ({
		key: String(a.id),
		category,
		color: colorOf[category],
		// Durations can be missing; fall back to an even split so every activity of
		// the day still shows up.
		share: total > 0 ? num(a.duration_s) / total : 1 / ordered.length,
		radius,
	}));
}

// Pie wedge from `from` to `to`, both as fractions of a turn measured clockwise
// from 12 o'clock. Callers draw a plain circle for a single full-turn slice.
export function wedgePath(radius: number, from: number, to: number): string {
	const c = VIEWBOX / 2;
	const point = (t: number) => {
		const angle = 2 * Math.PI * t - Math.PI / 2;
		return `${(c + radius * Math.cos(angle)).toFixed(2)} ${(c + radius * Math.sin(angle)).toFixed(2)}`;
	};
	const largeArc = to - from > 0.5 ? 1 : 0;
	return `M ${c} ${c} L ${point(from)} A ${radius} ${radius} 0 ${largeArc} 1 ${point(to)} Z`;
}
