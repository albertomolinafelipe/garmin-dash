import {
	type Category,
	categoryOf,
	typeLabel,
	needsAnnotation,
} from "@/lib/activity-types";
import { num, type CalendarActivity } from "@/lib/queries";

export type ViewMode = "list" | "cards";

export interface Range {
	min: number | null;
	max: number | null;
}

export interface ActivityFilters {
	search: string;
	from: string;
	to: string;
	categories: Category[];
	distanceKm: Range;
	durationH: Range;
	elevationM: Range;
	needsAnnotationOnly: boolean;
}

export const EMPTY_RANGE: Range = { min: null, max: null };

export const emptyFilters: ActivityFilters = {
	search: "",
	from: "",
	to: "",
	categories: [],
	distanceKm: EMPTY_RANGE,
	durationH: EMPTY_RANGE,
	elevationM: EMPTY_RANGE,
	needsAnnotationOnly: false,
};

// Filters live in the URL so that opening an activity and coming back restores
// the exact view, and so a filtered list can be linked to.
export function filtersToParams(
	filters: ActivityFilters,
	view: ViewMode,
	page: number,
): URLSearchParams {
	const params = new URLSearchParams();
	const set = (key: string, value: string | number | null) => {
		if (value !== null && value !== "") params.set(key, String(value));
	};
	set("q", filters.search);
	set("from", filters.from);
	set("to", filters.to);
	set("sports", filters.categories.join(","));
	set("distMin", filters.distanceKm.min);
	set("distMax", filters.distanceKm.max);
	set("durMin", filters.durationH.min);
	set("durMax", filters.durationH.max);
	set("vertMin", filters.elevationM.min);
	set("vertMax", filters.elevationM.max);
	if (filters.needsAnnotationOnly) params.set("todo", "1");
	if (view !== "list") params.set("view", view);
	if (page > 0) params.set("page", String(page + 1));
	return params;
}

export function filtersFromParams(params: URLSearchParams): {
	filters: ActivityFilters;
	view: ViewMode;
	page: number;
} {
	const number = (key: string) => {
		const raw = params.get(key);
		return raw === null || raw === "" ? null : Number(raw);
	};
	const view = params.get("view");
	return {
		filters: {
			search: params.get("q") ?? "",
			from: params.get("from") ?? "",
			to: params.get("to") ?? "",
			categories: (params.get("sports")?.split(",").filter(Boolean) ??
				[]) as Category[],
			distanceKm: { min: number("distMin"), max: number("distMax") },
			durationH: { min: number("durMin"), max: number("durMax") },
			elevationM: { min: number("vertMin"), max: number("vertMax") },
			needsAnnotationOnly: params.get("todo") === "1",
		},
		view: view === "cards" ? "cards" : "list",
		page: Math.max(0, Number(params.get("page") ?? 1) - 1),
	};
}

const inRange = (value: number, range: Range) =>
	(range.min == null || value >= range.min) &&
	(range.max == null || value <= range.max);

export function countActiveFilters(f: ActivityFilters): number {
	return [
		f.from !== "" || f.to !== "",
		f.categories.length > 0,
		f.distanceKm.min != null || f.distanceKm.max != null,
		f.durationH.min != null || f.durationH.max != null,
		f.elevationM.min != null || f.elevationM.max != null,
		f.needsAnnotationOnly,
	].filter(Boolean).length;
}

export function filterActivities(
	activities: CalendarActivity[],
	filters: ActivityFilters,
): CalendarActivity[] {
	const query = filters.search.trim().toLocaleLowerCase();
	return activities.filter((activity) => {
		const day = activity.start_time?.slice(0, 10) ?? "";
		if (filters.from && day < filters.from) return false;
		if (filters.to && day > filters.to) return false;

		if (
			filters.categories.length > 0 &&
			!filters.categories.includes(
				categoryOf(activity.activity_type, activity.subtype),
			)
		) {
			return false;
		}

		if (!inRange(num(activity.distance_m) / 1000, filters.distanceKm))
			return false;
		if (!inRange(num(activity.duration_s) / 3600, filters.durationH))
			return false;
		if (!inRange(num(activity.elevation_gain_m), filters.elevationM))
			return false;

		if (filters.needsAnnotationOnly && !needsAnnotation(activity)) return false;

		if (!query) return true;
		const searchable = [
			activity.name,
			activity.activity_type,
			activity.subtype,
			typeLabel(activity.activity_type, activity.subtype),
			day,
		]
			.filter(Boolean)
			.join(" ")
			.toLocaleLowerCase();
		return searchable.includes(query);
	});
}
