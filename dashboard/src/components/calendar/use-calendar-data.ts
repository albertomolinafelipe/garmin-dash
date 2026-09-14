import { useMemo } from "react";

import {
	useDayPlansQuery,
	useRacesQuery,
	useWeekNotesQuery,
	useWeekObjectivesQuery,
} from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import { toIsoWeek } from "@/lib/plans";
import { type CalendarActivity, useActivities } from "@/lib/queries";
import {
	computeWeekTotals,
	type DayPlan,
	indexDayPlans,
	indexObjectives,
	indexRaces,
	indexWeekNotes,
	type Race,
	type WeekNote,
	type WeekObjective,
} from "./model";

// Everything the calendar surfaces need, already indexed for per-cell lookup.
// Both the month calendar and the overview week strip read from here so a new
// calendar layer only has to be added once.
export function useCalendarData() {
	const { data, isLoading } = useActivities();
	const { data: dayPlans } = useDayPlansQuery();
	const { data: objectives } = useWeekObjectivesQuery();
	const { data: weekNotes } = useWeekNotesQuery();
	const { data: races } = useRacesQuery();

	const activities = useMemo(() => data?.activities ?? [], [data]);

	const dayPlansByDay = useMemo(
		() => indexDayPlans((dayPlans ?? []) as DayPlan[]),
		[dayPlans],
	);
	const objectivesByWeek = useMemo(
		() => indexObjectives((objectives ?? []) as WeekObjective[]),
		[objectives],
	);
	const noteByWeek = useMemo(
		() => indexWeekNotes((weekNotes ?? []) as WeekNote[]),
		[weekNotes],
	);
	const racesByDay = useMemo(
		() => indexRaces((races ?? []) as Race[]),
		[races],
	);
	const totalsByWeekStart = useMemo(
		() => computeWeekTotals(activities),
		[activities],
	);
	const activitiesByWeek = useMemo(() => {
		const map = new Map<string, CalendarActivity[]>();
		for (const a of activities) {
			if (!a.start_time) continue;
			const key = toIsoWeek(new Date(a.start_time));
			(map.get(key) ?? map.set(key, []).get(key))?.push(a);
		}
		return map;
	}, [activities]);

	return {
		activities,
		isLoading,
		dayPlansByDay,
		objectivesByWeek,
		noteByWeek,
		racesByDay,
		totalsByWeekStart,
		activitiesByWeek,
	};
}

// Activities for one day, optionally narrowed to a category filter.
export function indexActivitiesByDay(
	activities: CalendarActivity[],
	keep: (a: CalendarActivity) => boolean = () => true,
): Map<string, CalendarActivity[]> {
	const map = new Map<string, CalendarActivity[]>();
	for (const a of activities) {
		if (!a.start_time || !keep(a)) continue;
		const key = dayKey(new Date(a.start_time));
		(map.get(key) ?? map.set(key, []).get(key))?.push(a);
	}
	return map;
}
