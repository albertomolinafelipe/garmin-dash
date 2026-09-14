import { categoryOf, effectiveSubtype } from "@/lib/activity-types";
import { dayKey, fmtDistance, fmtDuration } from "@/lib/format";
import { type CalendarActivity, num } from "@/lib/queries";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Subtype plus the headline numbers, e.g. "Trail · 12.4 km · 1h 20m". Lives here
// rather than next to DayEvent so the hover preview can reuse it without the
// two modules importing each other.
export function eventInfo(a: CalendarActivity): string {
	const parts: string[] = [];
	const sub = effectiveSubtype(a.activity_type, a.subtype);
	if (sub) parts.push(cap(sub));
	if (num(a.distance_m)) parts.push(fmtDistance(num(a.distance_m)));
	if (num(a.duration_s)) parts.push(fmtDuration(num(a.duration_s)));
	return parts.join(" · ");
}

export function startOfWeek(d: Date): Date {
	const x = new Date(d);
	x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
	x.setHours(0, 0, 0, 0);
	return x;
}

export function addDays(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

export interface DayPlan {
	id: unknown;
	date: string;
	sport: string | null;
	note: string;
}

export interface WeekObjective {
	id: unknown;
	week: string;
	sport: string | null;
	metric: string;
	target: unknown;
}

export interface WeekNote {
	week: string;
	note: string;
}

export interface Race {
	id: unknown;
	date: string;
	name: string;
	distance_m: number | string | null;
	elevation_gain_m: number | string | null;
}

// Group rows into a lookup keyed by one of their own fields, so per-day and
// per-week rendering is O(1) instead of a filter per cell.
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const row of rows) {
		const k = key(row);
		(map.get(k) ?? map.set(k, []).get(k))?.push(row);
	}
	return map;
}

export const indexDayPlans = (plans: DayPlan[]) =>
	groupBy(plans, (p) => p.date);
export const indexObjectives = (objectives: WeekObjective[]) =>
	groupBy(objectives, (o) => o.week);
export const indexRaces = (races: Race[]) => groupBy(races, (r) => r.date);

export function indexWeekNotes(notes: WeekNote[]): Map<string, string> {
	return new Map(notes.map((n) => [n.week, n.note]));
}

export interface WeekTotals {
	runKm: number;
	runVert: number;
	runH: number;
	climbH: number;
	weightsH: number;
}

export function computeWeekTotals(
	acts: CalendarActivity[],
): Map<string, WeekTotals> {
	const map = new Map<string, WeekTotals>();
	for (const a of acts) {
		if (!a.start_time) continue;
		const key = dayKey(startOfWeek(new Date(a.start_time)));
		let t = map.get(key);
		if (!t) {
			t = { runKm: 0, runVert: 0, runH: 0, climbH: 0, weightsH: 0 };
			map.set(key, t);
		}
		const hours = num(a.duration_s) / 3600;
		const category = categoryOf(a.activity_type, a.subtype);
		if (category === "running") {
			t.runKm += num(a.distance_m) / 1000;
			t.runVert += num(a.elevation_gain_m);
			t.runH += hours;
		} else if (category === "climbing") {
			t.climbH += hours;
		} else if (category === "strength") {
			t.weightsH += hours;
		}
	}
	return map;
}

// Actual total for one objective's metric, restricted to its sport when set.
export function objectiveActual(
	acts: CalendarActivity[],
	metric: string,
	sport: string | null,
): number {
	let total = 0;
	for (const a of acts) {
		if (sport && categoryOf(a.activity_type, a.subtype) !== sport) continue;
		if (metric === "sessions") total += 1;
		else if (metric === "distance") total += num(a.distance_m);
		else if (metric === "elevation") total += num(a.elevation_gain_m);
		else if (metric === "duration") total += num(a.duration_s);
	}
	return total;
}
