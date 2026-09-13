import {
	type ComponentProps,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { AddObjectiveSheet } from "@/components/add-objective-sheet";
import { AddDayPlanSheet } from "@/components/add-day-plan-sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	addDays,
	computeWeekTotals,
	DayEvent,
	type DayPlan,
	DayRaces,
	dayDropProps,
	DayPlans,
	indexRaces,
	indexObjectives,
	indexDayPlans,
	DayPlanDndProvider,
	type Race,
	useDayPlanDnd,
	startOfWeek,
	TotalRow,
	WeekObjectives,
	WEEKDAYS,
} from "@/components/calendar-week";
import {
	useDayPlansQuery,
	useRacesQuery,
	useWeekObjectivesQuery,
} from "@/graphql/hooks";
import { toIsoWeek } from "@/lib/plans";
import {
	type Category,
	CATEGORY_ORDER,
	categoryColor,
	categoryIcon,
	categoryOf,
} from "@/lib/activity-types";
import { dayKey } from "@/lib/format";
import { type CalendarActivity, useActivities } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function Calendar() {
	return (
		<DayPlanDndProvider>
			<CalendarInner />
		</DayPlanDndProvider>
	);
}

// Month token 'YYYY-MM' <-> Date (first of month), used to persist the viewed
// month in the URL so returning from an activity lands on the same month.
function monthToken(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function parseMonthToken(token: string | null): Date | null {
	if (!token) return null;
	const match = /^(\d{4})-(\d{2})$/.exec(token);
	if (!match) return null;
	return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function ScrollableDayCell({
	children,
	className,
	contentClassName,
	...props
}: ComponentProps<"div"> & { contentClassName?: string }) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [hasMoreBelow, setHasMoreBelow] = useState(false);
	const updateShadow = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;
		setHasMoreBelow(
			element.scrollHeight - element.scrollTop - element.clientHeight > 1,
		);
	}, []);

	useEffect(() => {
		updateShadow();
		const element = scrollRef.current;
		if (!element) return;
		const observer = new ResizeObserver(updateShadow);
		observer.observe(element);
		return () => observer.disconnect();
	});

	return (
		<div className={cn("relative min-h-0 min-w-0", className)} {...props}>
			<div
				ref={scrollRef}
				onScroll={updateShadow}
				className={cn(
					"flex h-full flex-col overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
					contentClassName,
				)}
			>
				{children}
			</div>
			{hasMoreBelow ? (
				<div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/20 to-transparent dark:from-black/40" />
			) : null}
		</div>
	);
}

function CalendarInner() {
	const [searchParams, setSearchParams] = useSearchParams();
	const cursor = parseMonthToken(searchParams.get("month")) ?? new Date();
	const setCursor = (date: Date) =>
		setSearchParams(
			(prev) => {
				prev.set("month", monthToken(date));
				return prev;
			},
			{ replace: true },
		);
	const [filter, setFilter] = useState<Category | null>(null);
	const dnd = useDayPlanDnd();
	const { data, isLoading } = useActivities();
	const { data: dayPlans } = useDayPlansQuery();
	const { data: objectives } = useWeekObjectivesQuery();
	const { data: races } = useRacesQuery();
	const [planDay, setPlanDay] = useState<Date | null>(null);
	const [objectiveWeek, setObjectiveWeek] = useState<string | null>(null);

	const activities = data?.activities ?? [];
	const dayPlansByDay = useMemo(
		() => indexDayPlans((dayPlans ?? []) as DayPlan[]),
		[dayPlans],
	);
	const racesByDay = useMemo(
		() => indexRaces((races ?? []) as Race[]),
		[races],
	);
	const objectivesByWeek = useMemo(
		() => indexObjectives(objectives ?? []),
		[objectives],
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

	const byDay = useMemo(() => {
		const map = new Map<string, CalendarActivity[]>();
		for (const a of activities) {
			if (!a.start_time) continue;
			if (filter && categoryOf(a.activity_type, a.subtype) !== filter) continue;
			const key = dayKey(new Date(a.start_time));
			(map.get(key) ?? map.set(key, []).get(key))?.push(a);
		}
		return map;
	}, [activities, filter]);

	const totals = useMemo(() => computeWeekTotals(activities), [activities]);

	const weeks = useMemo(() => {
		const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
		const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
		const start = startOfWeek(first);
		const end = startOfWeek(last);
		const out: Date[] = [];
		for (let w = start; w <= end; w = addDays(w, 7)) out.push(new Date(w));
		return out;
	}, [cursor]);

	const presentCats = useMemo(() => {
		const set = new Set<Category>();
		for (const a of activities) set.add(categoryOf(a.activity_type, a.subtype));
		return CATEGORY_ORDER.filter((c) => set.has(c));
	}, [activities]);

	const month = cursor.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	return (
		<div className="flex h-full min-h-[520px] flex-col gap-4 p-4">
			<AddDayPlanSheet day={planDay} onClose={() => setPlanDay(null)} />
			<AddObjectiveSheet
				week={objectiveWeek}
				onClose={() => setObjectiveWeek(null)}
			/>
			{/* Toolbar */}
			<div className="relative flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-wrap items-center gap-4">
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							aria-label="Today"
							onClick={() => setCursor(new Date())}
						>
							<CalendarDays />
						</Button>
						<Button
							variant="outline"
							size="icon"
							aria-label="Previous month"
							onClick={() =>
								setCursor(
									new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
								)
							}
						>
							<ChevronLeft />
						</Button>
						<Button
							variant="outline"
							size="icon"
							aria-label="Next month"
							onClick={() =>
								setCursor(
									new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
								)
							}
						>
							<ChevronRight />
						</Button>
					</div>
					<div className="text-sm font-semibold sm:hidden">{month}</div>
					<Separator orientation="vertical" className="hidden h-6 sm:block" />
					<div className="flex items-center gap-1">
						{presentCats.map((c) => {
							const Icon = categoryIcon[c];
							const active = filter === c;
							return (
								<Button
									key={c}
									variant="ghost"
									size="icon"
									aria-label={`Filter ${c}`}
									aria-pressed={active}
									onClick={() => setFilter(active ? null : c)}
									style={
										active
											? { backgroundColor: categoryColor[c], color: "#fff" }
											: { color: categoryColor[c] }
									}
								>
									<Icon />
								</Button>
							);
						})}
					</div>
				</div>
				<div className="hidden text-sm font-semibold sm:block md:absolute md:left-1/2 md:-translate-x-1/2">
					{month}
				</div>
			</div>

			{/* Month grid + week-totals column */}
			<div className="bg-card flex min-h-0 flex-1 overflow-hidden rounded-xl border">
				{/* Days */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="grid grid-cols-7 border-b">
						{WEEKDAYS.map((d) => (
							<div
								key={d}
								className="text-muted-foreground flex h-9 items-center justify-center text-[11px] font-medium tracking-wide uppercase"
							>
								{d}
							</div>
						))}
					</div>
					<div className="flex min-h-0 flex-1 flex-col">
						{weeks.map((w) => (
							<div
								key={dayKey(w)}
								className="grid min-h-0 flex-1 grid-cols-7 border-b last:border-b-0"
							>
								{Array.from({ length: 7 }, (_, i) => addDays(w, i)).map(
									(day) => {
										const offMonth = day.getMonth() !== cursor.getMonth();
										const events = byDay.get(dayKey(day)) ?? [];
										return (
											<ScrollableDayCell
												key={dayKey(day)}
												{...dayDropProps(dnd, day)}
												className={cn(
													"border-r last:border-r-0",
													offMonth &&
														"bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]",
												)}
											>
												<div
													className={cn(
														"bg-card sticky top-0 z-10 flex items-center justify-end gap-0.5 px-1 pt-1 pb-0.5",
														offMonth &&
															"bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]",
													)}
												>
													<Button
														variant="ghost"
														size="icon"
														className="text-muted-foreground size-5 opacity-50 hover:opacity-100"
														aria-label={`Add plan on ${day.toLocaleDateString()}`}
														onClick={() => setPlanDay(day)}
													>
														<Plus className="size-3" />
													</Button>
													<div
														className={cn(
															"text-muted-foreground text-right text-xs",
															offMonth && "opacity-50",
														)}
													>
														{day.getDate()}
													</div>
												</div>
												<div className="flex min-h-0 flex-1 flex-col p-1 pt-0">
													<div className="mt-2 flex flex-col gap-1">
														<DayRaces
															day={day}
															byDay={racesByDay}
															activitiesByDay={byDay}
														/>
														{events.map((a) => (
															<DayEvent
																key={a.id}
																a={a}
																isRace={
																	(racesByDay.get(dayKey(day))?.length ?? 0) > 0
																}
															/>
														))}
													</div>
													<DayPlans day={day} byDay={dayPlansByDay} />
												</div>
											</ScrollableDayCell>
										);
									},
								)}
							</div>
						))}
					</div>
				</div>

				{/* Week totals */}
				<div className="bg-muted/30 hidden w-44 flex-col border-l md:flex">
					<div className="text-muted-foreground flex h-9 items-center justify-center border-b text-[11px] font-semibold tracking-wide uppercase">
						Week totals
					</div>

					<div className="flex min-h-0 flex-1 flex-col">
						{weeks.map((w) => {
							const t = totals.get(dayKey(w));
							return (
								<ScrollableDayCell
									key={dayKey(w)}
									className="min-h-0 flex-1 border-b last:border-b-0"
									contentClassName="gap-1 p-2"
								>
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground absolute top-1 right-1 size-5 opacity-50 hover:opacity-100"
										aria-label={`Add objective for ${toIsoWeek(w)}`}
										onClick={() => setObjectiveWeek(toIsoWeek(w))}
									>
										<Plus className="size-3" />
									</Button>
									<div className="flex items-start gap-1.5">
										<categoryIcon.running
											size={12}
											className="mt-0.5 shrink-0"
											style={{ color: categoryColor.running }}
										/>
										<div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-tight">
											<span
												className={cn(
													"text-xs font-semibold",
													!t?.runKm && "text-muted-foreground font-normal",
												)}
											>
												{(t?.runKm ?? 0).toFixed(1)} km
											</span>
											<span className="text-muted-foreground text-[11px]">
												· {(t?.runH ?? 0).toFixed(1)} h ·{" "}
												{Math.round(t?.runVert ?? 0)} m
											</span>
										</div>
									</div>
									<TotalRow
										category="climbing"
										value={`${(t?.climbH ?? 0).toFixed(1)} h`}
										zero={!t?.climbH}
									/>
									<TotalRow
										category="strength"
										value={`${(t?.weightsH ?? 0).toFixed(1)} h`}
										zero={!t?.weightsH}
									/>
									<WeekObjectives
										objectives={objectivesByWeek.get(toIsoWeek(w)) ?? []}
										activities={activitiesByWeek.get(toIsoWeek(w)) ?? []}
									/>
								</ScrollableDayCell>
							);
						})}
					</div>
				</div>
			</div>

			{isLoading && (
				<p className="text-muted-foreground text-sm">Loading activities…</p>
			)}
		</div>
	);
}
