import { useState } from "react";

import { dayKey } from "@/lib/format";
import { toIsoWeek } from "@/lib/plans";
import type { CalendarActivity } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { SelectableCell } from "./cell";
import { DayPlanDialog, type DayPlanTarget } from "./day-plan-dialog";
import { DayPlans } from "./day-plans";
import { dayDropProps, useDayPlanDnd } from "./dnd";
import { DayEvent, DayRaces } from "./events";
import {
	addDays,
	type DayPlan,
	type Race,
	WEEKDAYS,
	type WeekObjective,
	type WeekTotals,
} from "./model";
import { ObjectiveDialog, type ObjectiveTarget } from "./objective-dialog";
import {
	WeekNotePreview,
	WeekObjectives,
	WeekTotalsBlock,
} from "./week-column";
import { WeekNoteDialog } from "./week-note-dialog";

// A single-week slice of the calendar: seven day columns (Mon–Sun) with their
// events. `weekStart` must be a Monday (use startOfWeek). Pass `totals` to show
// a week-totals column on the right (md+).
export function WeekStrip({
	weekStart,
	byDay,
	dayPlansByDay,
	racesByDay,
	totals,
	objectives,
	weekNote,
}: {
	weekStart: Date;
	byDay: Map<string, CalendarActivity[]>;
	dayPlansByDay?: Map<string, DayPlan[]>;
	racesByDay?: Map<string, Race[]>;
	totals?: WeekTotals;
	objectives?: WeekObjective[];
	weekNote?: string;
}) {
	const today = dayKey(new Date());
	const dnd = useDayPlanDnd();
	const week = toIsoWeek(weekStart);
	const [planTarget, setPlanTarget] = useState<DayPlanTarget | null>(null);
	const [objectiveTarget, setObjectiveTarget] =
		useState<ObjectiveTarget | null>(null);
	const [noteWeek, setNoteWeek] = useState<string | null>(null);
	const showTotals = totals !== undefined || objectives !== undefined;
	const weekActivities = showTotals ? Array.from(byDay.values()).flat() : [];

	return (
		<div className="bg-card flex h-full overflow-hidden rounded-lg border">
			<DayPlanDialog
				target={planTarget}
				onClose={() => setPlanTarget(null)}
			/>
			<ObjectiveDialog
				target={objectiveTarget}
				onClose={() => setObjectiveTarget(null)}
			/>
			<WeekNoteDialog
				week={noteWeek}
				note={weekNote}
				onClose={() => setNoteWeek(null)}
			/>
			<div className="grid min-w-0 flex-1 grid-cols-7">
				{Array.from({ length: 7 }, (_, i) => i).map((i) => {
					const day = addDays(weekStart, i);
					const key = dayKey(day);
					const events = byDay.get(key) ?? [];
					const isToday = key === today;
					return (
						<SelectableCell
							key={key}
							{...dayDropProps(dnd, day)}
							label={`Add plan on ${day.toLocaleDateString()}`}
							onSelect={() => setPlanTarget({ day })}
							className="flex min-h-0 min-w-0 flex-col border-r last:border-r-0"
							contentClassName="flex min-h-0 flex-1 flex-col"
						>
							<div
								className={cn(
									"flex items-baseline justify-between gap-1 border-b px-1.5 py-1",
									isToday && "bg-accent/50",
								)}
							>
								<span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
									{WEEKDAYS[i]}
								</span>
								<span
									className={cn(
										"text-xs",
										isToday ? "font-semibold" : "text-muted-foreground",
									)}
								>
									{day.getDate()}
								</span>
							</div>
							<div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1 pt-2">
								<DayRaces day={day} byDay={racesByDay} activitiesByDay={byDay} />
								{events.map((a) => (
									<DayEvent
										key={a.id}
										a={a}
										isRace={(racesByDay?.get(key)?.length ?? 0) > 0}
									/>
								))}
								{dayPlansByDay ? (
									<DayPlans
										day={day}
										byDay={dayPlansByDay}
										onEdit={(plan) => setPlanTarget({ day, plan })}
									/>
								) : null}
							</div>
						</SelectableCell>
					);
				})}
			</div>
			{showTotals ? (
				<aside className="bg-muted/30 hidden w-44 shrink-0 flex-col border-l md:flex">
					<div className="flex items-center border-b px-2 py-1">
						<span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
							Week totals
						</span>
					</div>
					<SelectableCell
						label={`Edit note for ${week}`}
						onSelect={() => setNoteWeek(week)}
						className="flex min-h-0 flex-1 flex-col"
						contentClassName="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2"
					>
						<WeekTotalsBlock totals={totals} />
						<WeekNotePreview note={weekNote} />
						{objectives ? (
							<WeekObjectives
								objectives={objectives}
								activities={weekActivities}
								onAdd={() => setObjectiveTarget({ week })}
								onEdit={(objective) =>
									setObjectiveTarget({ week, objective })
								}
							/>
						) : null}
					</SelectableCell>
				</aside>
			) : null}
		</div>
	);
}
