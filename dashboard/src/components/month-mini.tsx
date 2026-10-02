import { useMemo, useState } from "react";

import { addDays, startOfWeek } from "@/components/calendar/model";
import {
	indexActivitiesByDay,
	useCalendarData,
} from "@/components/calendar/use-calendar-data";
import { DayActivitiesPreview } from "@/components/calendar/day-activities-preview";
import { HoverPreview } from "@/components/hover-preview";
import { PanelNav } from "@/components/panel-nav";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { categoryColor } from "@/lib/activity-types";
import {
	dayMarker,
	type DaySlice,
	VIEWBOX,
	wedgePath,
} from "@/lib/day-marker";
import { dayKey } from "@/lib/format";
import { raceIcon } from "@/lib/plans";
import { cn } from "@/lib/utils";

// Matches the plots' treatment: a solid line around a translucent body. STROKE_W
// is in the marker's 100-unit viewBox, so it scales with the panel.
const FILL_OPACITY = 0.35;
const STROKE_W = 2.5;

const RaceIcon = raceIcon;

// The weeks (Mon-start) that cover the given month, as their start dates.
function weeksOfMonth(month: Date): Date[] {
	const first = new Date(month.getFullYear(), month.getMonth(), 1);
	const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
	const out: Date[] = [];
	for (let w = startOfWeek(first); w <= startOfWeek(last); w = addDays(w, 7))
		out.push(new Date(w));
	return out;
}

// The day's training as a single dot: one activity fills it, several split it
// into wedges angled by duration, on a radius set by the day's longest activity.
// Each activity keeps its own wedge, so two runs read as two slices rather than
// one. Drawn like the plots: solid outline over a translucent fill.
function DayMarker({
	slices,
	className,
}: {
	slices: DaySlice[];
	className?: string;
}) {
	const center = VIEWBOX / 2;
	return (
		<svg
			viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
			preserveAspectRatio="xMidYMid meet"
			className={cn("h-full w-full", className)}
			aria-hidden="true"
		>
			{slices.length === 1 ? (
				<circle
					cx={center}
					cy={center}
					r={slices[0].radius}
					fill={slices[0].color}
					fillOpacity={FILL_OPACITY}
					stroke={slices[0].color}
					strokeWidth={STROKE_W}
				/>
			) : (
				slices.map((slice, i) => {
					const from = slices.slice(0, i).reduce((sum, s) => sum + s.share, 0);
					return (
						<path
							key={slice.key}
							d={wedgePath(slice.radius, from, from + slice.share)}
							fill={slice.color}
							fillOpacity={FILL_OPACITY}
							stroke={slice.color}
							strokeWidth={STROKE_W}
							strokeLinejoin="round"
						/>
					);
				})
			)}
		</svg>
	);
}

// A month at a glance: one square per day, dimmed outside the month, carrying a
// dot for whatever was trained. Deliberately number-free — it is a shape, not a
// date picker.
export function MonthMini({ className }: { className?: string }) {
	const [offsetMonths, setOffsetMonths] = useState(0);
	const month = useMemo(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
	}, [offsetMonths]);
	const weeks = useMemo(() => weeksOfMonth(month), [month]);
	const todayKey = dayKey(new Date());

	const { activities, racesByDay } = useCalendarData();
	const byDay = useMemo(() => indexActivitiesByDay(activities), [activities]);
	// Which day's card is open. Hover handles it on a pointer, but the dots are
	// small and touch has no hover, so the cell opens it on click too.
	const [openDay, setOpenDay] = useState<string | null>(null);

	return (
		<Card className={cn("min-h-0 gap-2 py-3", className)}>
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					{month.toLocaleDateString(undefined, {
						month: "long",
						year: "numeric",
					})}
				</CardTitle>
				<CardAction>
					<PanelNav
						unit="month"
						canForward={offsetMonths < 0}
						back={() => setOffsetMonths((m) => m - 1)}
						forward={() => setOffsetMonths((m) => Math.min(0, m + 1))}
						latest={() => setOffsetMonths(0)}
					/>
				</CardAction>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 px-4 pb-1">
				<div className="flex h-full min-h-0 flex-col gap-1">
					{weeks.map((w) => (
						<div
							key={dayKey(w)}
							className="grid min-h-0 flex-1 grid-cols-7 gap-1"
						>
							{Array.from({ length: 7 }, (_, i) => addDays(w, i)).map((day) => {
								const key = dayKey(day);
								const offMonth = day.getMonth() !== month.getMonth();
								const dayActivities = byDay.get(key) ?? [];
								const slices = dayMarker(dayActivities, categoryColor);
								// A laurel marks race days. Upcoming races are faint: the race
								// is on the calendar but hasn't been run yet, so it shouldn't
								// read as solidly as one already in the bag.
								const hasRace = (racesByDay.get(key)?.length ?? 0) > 0;
								let raceFade: string | undefined;
								if (offMonth) raceFade = "opacity-25";
								else if (key > todayKey) raceFade = "opacity-40";
								const raceMark = hasRace ? (
									<span
										className={cn(
											"text-race pointer-events-none absolute inset-0 flex items-center justify-center",
											raceFade,
										)}
									>
										<RaceIcon className="size-[70%]" />
									</span>
								) : null;
								const cellClass = cn(
									"bg-muted/60 relative min-h-0 rounded-sm border border-transparent",
									// Neighbouring months keep their square so the grid stays a
									// full block rather than dots floating on blank panel.
									offMonth && "bg-muted/25",
									key === todayKey && "border-foreground/40",
								);

								if (slices.length === 0) {
									return (
										<div key={key} className={cellClass}>
											{raceMark}
										</div>
									);
								}
								return (
									<HoverPreview
										key={key}
										side="top"
										align="center"
										openDelay={150}
										open={openDay === key}
										onOpenChange={(open) => setOpenDay(open ? key : null)}
										content={() => (
											<DayActivitiesPreview
												day={day}
												activities={dayActivities}
											/>
										)}
									>
										<button
											type="button"
											aria-label={`Activities on ${day.toLocaleDateString()}`}
											onClick={() => setOpenDay(key)}
											className={cn(
												cellClass,
												"focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none",
												key === openDay && "bg-accent",
											)}
										>
											<DayMarker
												slices={slices}
												className={offMonth ? "opacity-25" : undefined}
											/>
											{raceMark}
										</button>
									</HoverPreview>
								);
							})}
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
