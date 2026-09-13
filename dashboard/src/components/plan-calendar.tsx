import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
	addDays,
	DayEvent,
	DayRaces,
	dayDropProps,
	DayWorkouts,
	indexRaces,
	indexRequirements,
	indexWorkouts,
	type PlanRequirement,
	type PlanWorkout,
	PlanWorkoutDndProvider,
	type Race,
	RequirementBar,
	requirementActual,
	useWorkoutDnd,
	WEEKDAYS,
} from "@/components/calendar-week";
import { AddRequirementSheet } from "@/components/add-requirement-sheet";
import {
	AddWorkoutSheet,
	type PlanOption,
} from "@/components/add-workout-sheet";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import {
	useAllPlanRequirementsQuery,
	useAllPlanWorkoutsQuery,
	useDeletePlanRequirementMutation,
	useRacesQuery,
	useUpdatePlanRequirementMutation,
} from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import {
	isoWeekStart,
	type Metric,
	METRIC_META,
	sportIcon,
	toIsoWeek,
	weeksInRange,
} from "@/lib/plans";
import { type CalendarActivity, useActivities } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type CalendarPlan = PlanOption;

const ROW_GRID =
	"grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] md:grid-cols-[4.5rem_repeat(7,minmax(0,1fr))_16rem]";

function RequirementRow({
	requirement,
	activities,
	onRefresh,
}: {
	requirement: PlanRequirement;
	activities: CalendarActivity[];
	onRefresh: () => Promise<void>;
}) {
	const update = useUpdatePlanRequirementMutation();
	const remove = useDeletePlanRequirementMutation();
	const meta = METRIC_META[requirement.metric as Metric];
	const target = Number(requirement.target);
	const actual = requirementActual(
		activities,
		requirement.metric,
		requirement.sport,
	);
	const [draft, setDraft] = useState<number | null>(null);
	const editing = draft !== null;
	const SportIcon = sportIcon(requirement.sport);
	const MetricIcon = meta?.icon;

	const saveTarget = async () => {
		if (draft === null || update.isPending) return;
		try {
			await update.mutateAsync({
				id: requirement.id,
				set: { target: meta.toBase(draft) },
			});
			setDraft(null);
			await onRefresh();
		} catch {
			toast.error("Could not update the requirement");
		}
	};

	const del = async () => {
		try {
			await remove.mutateAsync({ id: requirement.id });
			await onRefresh();
		} catch {
			toast.error("Could not delete the requirement");
		}
	};

	return (
		<div className="group/req flex flex-col gap-0.5">
			<div className="flex items-center gap-1 text-[11px] leading-none">
				<SportIcon size={12} className="text-muted-foreground shrink-0" />
				{MetricIcon ? (
					<MetricIcon size={12} className="text-muted-foreground shrink-0" />
				) : null}
				{editing ? (
					<>
						<NumberInput
							autoFocus
							nonNegative
							value={draft}
							className="h-6 w-16 px-1 text-[11px]"
							onChange={setDraft}
							onKeyDown={(event) => {
								if (event.key === "Enter") void saveTarget();
								if (event.key === "Escape") setDraft(null);
							}}
						/>
						<span className="text-muted-foreground">{meta?.inputUnit}</span>
						<Button
							size="sm"
							variant="ghost"
							className="ml-auto h-6 px-1.5 text-[11px]"
							disabled={update.isPending}
							onClick={() => void saveTarget()}
						>
							Save
						</Button>
					</>
				) : (
					<>
						<span className="tabular-nums">
							{meta ? meta.format(actual) : actual}
						</span>
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground tabular-nums"
							aria-label={`Edit ${requirement.metric} target`}
							onClick={() => setDraft(meta.fromBase(target))}
						>
							/ {meta ? meta.format(target) : target}
						</button>
						<button
							type="button"
							aria-label={`Delete ${requirement.metric} requirement`}
							className="text-muted-foreground hover:text-destructive ml-auto shrink-0 opacity-0 group-hover/req:opacity-100"
							onClick={() => void del()}
						>
							<Trash2 className="size-3" />
						</button>
					</>
				)}
			</div>
			<RequirementBar
				sport={requirement.sport}
				metric={requirement.metric}
				target={target}
				actual={actual}
			/>
		</div>
	);
}

function DayCell({
	day,
	activities,
	racesByDay,
	workoutsByWeekDay,
	onAddWorkout,
}: {
	day: Date;
	activities: Map<string, CalendarActivity[]>;
	racesByDay: Map<string, Race[]>;
	workoutsByWeekDay: Map<string, PlanWorkout[]>;
	onAddWorkout: (day: Date) => void;
}) {
	const dnd = useWorkoutDnd();
	const key = dayKey(day);
	const isToday = key === dayKey(new Date());
	const events = activities.get(key) ?? [];
	return (
		<div
			{...dayDropProps(dnd, day)}
			className={cn(
				"flex min-w-0 flex-col gap-1 border-r p-1 last:border-r-0",
				isToday && "bg-accent/40",
			)}
		>
			<div className="flex items-center justify-between gap-1">
				<Button
					variant="ghost"
					size="icon"
					className="text-muted-foreground size-5 opacity-40 hover:opacity-100"
					aria-label={`Add workout on ${day.toLocaleDateString()}`}
					onClick={() => onAddWorkout(day)}
				>
					<Plus className="size-3" />
				</Button>
				<span
					className={cn(
						"text-xs tabular-nums",
						isToday ? "font-semibold" : "text-muted-foreground",
					)}
				>
					{day.getDate()}
				</span>
			</div>
			<DayRaces day={day} byDay={racesByDay} activitiesByDay={activities} />
			{events.map((activity) => (
				<DayEvent
					key={activity.id}
					compact
					a={activity}
					isRace={(racesByDay.get(key)?.length ?? 0) > 0}
				/>
			))}
			<DayWorkouts day={day} byWeekDay={workoutsByWeekDay} />
		</div>
	);
}

// A plan rendered as a calendar: one row per ISO week in the plan's range, with
// planned workouts on their days and the week's requirements tracked alongside.
export function PlanCalendar({ plan }: { plan: CalendarPlan }) {
	return (
		<PlanWorkoutDndProvider>
			<PlanCalendarGrid plan={plan} />
		</PlanWorkoutDndProvider>
	);
}

function PlanCalendarGrid({ plan }: { plan: CalendarPlan }) {
	const planId = String(plan.id);
	const queryClient = useQueryClient();
	const { data: activityData } = useActivities();
	const { data: allWorkouts } = useAllPlanWorkoutsQuery();
	const { data: allRequirements } = useAllPlanRequirementsQuery();
	const { data: races } = useRacesQuery();
	const [workoutDay, setWorkoutDay] = useState<Date | null>(null);
	const [requirementWeek, setRequirementWeek] = useState<string | null>(null);

	const activities = activityData?.activities ?? [];
	const weeks = useMemo(
		() => weeksInRange(plan.start_week, plan.end_week),
		[plan.start_week, plan.end_week],
	);
	const workoutsByWeekDay = useMemo(
		() =>
			indexWorkouts(
				(allWorkouts ?? []).filter((w) => String(w.plan_id) === planId),
			),
		[allWorkouts, planId],
	);
	const requirementsByWeek = useMemo(
		() =>
			indexRequirements(
				(allRequirements ?? []).filter((r) => String(r.plan_id) === planId),
			),
		[allRequirements, planId],
	);
	const racesByDay = useMemo(
		() => indexRaces((races ?? []) as Race[]),
		[races],
	);
	const activitiesByDay = useMemo(() => {
		const map = new Map<string, CalendarActivity[]>();
		for (const activity of activities) {
			if (!activity.start_time) continue;
			const key = dayKey(new Date(activity.start_time));
			(map.get(key) ?? map.set(key, []).get(key))?.push(activity);
		}
		return map;
	}, [activities]);
	const activitiesByWeek = useMemo(() => {
		const map = new Map<string, CalendarActivity[]>();
		for (const activity of activities) {
			if (!activity.start_time) continue;
			const key = toIsoWeek(new Date(activity.start_time));
			(map.get(key) ?? map.set(key, []).get(key))?.push(activity);
		}
		return map;
	}, [activities]);

	const refreshRequirements = async () => {
		await queryClient.invalidateQueries({ queryKey: ["plan-requirements"] });
	};

	const currentWeek = toIsoWeek(new Date());

	return (
		<div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
			<AddWorkoutSheet
				day={workoutDay}
				plans={[plan]}
				planId={planId}
				onClose={() => setWorkoutDay(null)}
			/>
			<AddRequirementSheet
				week={requirementWeek}
				plans={[plan]}
				planId={planId}
				onClose={() => setRequirementWeek(null)}
			/>
			<div className={cn(ROW_GRID, "border-b")}>
				<div className="text-muted-foreground flex h-9 items-center px-2 text-[11px] font-semibold tracking-wide uppercase">
					Week
				</div>
				{WEEKDAYS.map((weekday) => (
					<div
						key={weekday}
						className="text-muted-foreground flex h-9 items-center justify-center text-[11px] font-medium tracking-wide uppercase"
					>
						{weekday}
					</div>
				))}
				<div className="text-muted-foreground hidden h-9 items-center border-l px-2 text-[11px] font-semibold tracking-wide uppercase md:flex">
					Requirements
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				{weeks.map((week, index) => {
					const monday = isoWeekStart(week);
					const isCurrent = week === currentWeek;
					const requirements = requirementsByWeek.get(week) ?? [];
					const weekActivities = activitiesByWeek.get(week) ?? [];
					return (
						<div
							key={week}
							className={cn(
								ROW_GRID,
								"min-h-28 border-b last:border-b-0",
								isCurrent && "bg-primary/5",
							)}
						>
							<div className="flex flex-col justify-center border-r px-2 py-1 leading-tight">
								<span
									className={cn(
										"text-xs tabular-nums",
										isCurrent ? "font-semibold" : "font-medium",
									)}
								>
									{week.slice(5)}
								</span>
								<span className="text-muted-foreground text-[10px]">
									{monday.toLocaleDateString(undefined, {
										day: "numeric",
										month: "short",
									})}
								</span>
								<span className="text-muted-foreground text-[10px]">
									#{index + 1}/{weeks.length}
								</span>
							</div>
							{Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map(
								(day) => (
									<DayCell
										key={dayKey(day)}
										day={day}
										activities={activitiesByDay}
										racesByDay={racesByDay}
										workoutsByWeekDay={workoutsByWeekDay}
										onAddWorkout={setWorkoutDay}
									/>
								),
							)}
							<div className="hidden flex-col gap-1.5 border-l p-2 md:flex">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground text-[10px] tracking-wide uppercase">
										{requirements.length === 0 ? "None" : "Targets"}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground size-5 opacity-50 hover:opacity-100"
										aria-label={`Add requirement for ${week}`}
										onClick={() => setRequirementWeek(week)}
									>
										<Plus className="size-3" />
									</Button>
								</div>
								{requirements.map((requirement) => (
									<RequirementRow
										key={String(requirement.id)}
										requirement={requirement}
										activities={weekActivities}
										onRefresh={refreshRequirements}
									/>
								))}
							</div>
						</div>
					);
				})}
				{weeks.length === 0 ? (
					<p className="text-muted-foreground p-6 text-center text-sm">
						This plan's week range is empty.
					</p>
				) : null}
			</div>
		</div>
	);
}
