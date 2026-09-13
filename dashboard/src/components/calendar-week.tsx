import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	type Category,
	CATEGORY_ORDER,
	categoryColor,
	categoryIcon,
	categoryOf,
	effectiveSubtype,
	iconifyIcon,
	sportColor,
} from "@/lib/activity-types";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	useDeleteDayPlanMutation,
	useUpdateDayPlanMutation,
} from "@/graphql/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { dayKey, fmtDistance, fmtDuration } from "@/lib/format";
import {
	type Metric,
	METRIC_META,
	raceIcon,
	sportIcon,
} from "@/lib/plans";
import { type CalendarActivity, num } from "@/lib/queries";
import { cn } from "@/lib/utils";

export interface WeekObjective {
	id: unknown;
	week: string;
	sport: string | null;
	metric: string;
	target: unknown;
}

export function indexObjectives(
	objectives: WeekObjective[],
): Map<string, WeekObjective[]> {
	const map = new Map<string, WeekObjective[]>();
	for (const o of objectives) {
		(map.get(o.week) ?? map.set(o.week, []).get(o.week))?.push(o);
	}
	return map;
}

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

// Two-segment bar: the sport-coloured part is progress towards the target, the
// `--plan` part is the overshoot beyond it.
export function ObjectiveBar({
	sport,
	metric,
	target,
	actual,
}: {
	sport: string | null;
	metric: string;
	target: number;
	actual: number;
}) {
	const scale = Math.max(target, actual);
	const targetFill = scale > 0 ? (Math.min(actual, target) / scale) * 100 : 0;
	const extraFill =
		actual > target && scale > 0 ? ((actual - target) / scale) * 100 : 0;
	return (
		<div
			role="progressbar"
			aria-label={`${sport ?? "All sports"} ${metric} progress`}
			aria-valuemin={0}
			aria-valuenow={actual}
			aria-valuemax={scale}
			className="bg-primary/20 flex h-1 min-w-0 flex-1 overflow-hidden rounded-full"
		>
			<div
				className="h-full transition-[width]"
				style={{ width: `${targetFill}%`, backgroundColor: sportColor(sport) }}
			/>
			{extraFill > 0 ? (
				<div
					className="h-full bg-[var(--plan)] transition-[width]"
					style={{ width: `${extraFill}%` }}
				/>
			) : null}
		</div>
	);
}

export function WeekObjectives({
	objectives,
	activities,
}: {
	objectives: WeekObjective[];
	activities: CalendarActivity[];
}) {
	if (objectives.length === 0) return null;
	const sortKey = (sport: string | null) =>
		sport ? CATEGORY_ORDER.indexOf(sport as Category) : -1;
	const ordered = [...objectives].sort(
		(a, b) => sortKey(a.sport) - sortKey(b.sport),
	);
	return (
		<div className="mt-1 flex flex-col gap-1">
			{ordered.map((r) => {
				const meta = METRIC_META[r.metric as Metric];
				const target = Number(r.target);
				const actual = objectiveActual(activities, r.metric, r.sport);
				const SportIcon = sportIcon(r.sport);
				const MetricIcon = meta?.icon;
				return (
					<div key={String(r.id)} className="flex items-center gap-1.5">
						<ObjectiveBar
							sport={r.sport}
							metric={r.metric}
							target={target}
							actual={actual}
						/>
						<span className="text-muted-foreground flex w-20 shrink-0 items-center gap-1 text-[10px] tabular-nums">
							<SportIcon size={11} className="shrink-0" />
							{MetricIcon ? (
								<MetricIcon size={11} className="shrink-0" />
							) : null}
							<span className="truncate">
								{meta ? meta.format(target) : ""}
							</span>
						</span>
					</div>
				);
			})}
		</div>
	);
}

export interface DayPlan {
	id: unknown;
	date: string;
	sport: string | null;
	note: string;
}

// Drag-and-drop: dragging a day-plan chip onto a day cell moves it to that date.
// Shared by the month calendar and the week strip via context so the drop
// targets (page-owned day cells) and the drag source (DayPlanChip) coordinate
// without prop drilling.
interface DayPlanDndValue {
	onDragStartDayPlan: (p: DayPlan, e: React.DragEvent) => void;
	onDropDay: (day: Date, e: React.DragEvent) => void;
}

const DayPlanDndContext = createContext<DayPlanDndValue | null>(null);

export function DayPlanDndProvider({ children }: { children: ReactNode }) {
	const dragged = useRef<DayPlan | null>(null);
	const update = useUpdateDayPlanMutation();
	const queryClient = useQueryClient();

	const onDragStartDayPlan = useCallback((p: DayPlan, e: React.DragEvent) => {
		dragged.current = p;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(p.id));
	}, []);

	const onDropDay = useCallback(
		(day: Date, e: React.DragEvent) => {
			e.preventDefault();
			const p = dragged.current;
			dragged.current = null;
			if (!p) return;
			const date = dayKey(day);
			if (p.date === date) return;
			void (async () => {
				try {
					await update.mutateAsync({ id: p.id, set: { date } });
					await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
				} catch {
					toast.error("Could not move the plan");
				}
			})();
		},
		[update, queryClient],
	);

	const value = useMemo(
		() => ({ onDragStartDayPlan, onDropDay }),
		[onDragStartDayPlan, onDropDay],
	);
	return (
		<DayPlanDndContext.Provider value={value}>
			{children}
		</DayPlanDndContext.Provider>
	);
}

export function useDayPlanDnd(): DayPlanDndValue | null {
	return useContext(DayPlanDndContext);
}

// Plain helpers (not hooks) so they can be used inside `.map` day loops.
export function dayDropProps(dnd: DayPlanDndValue | null, day: Date) {
	if (!dnd) return {};
	return {
		onDragOver: (e: React.DragEvent) => e.preventDefault(),
		onDrop: (e: React.DragEvent) => dnd.onDropDay(day, e),
	};
}

export function dayPlanDragProps(dnd: DayPlanDndValue | null, p: DayPlan) {
	if (!dnd) return {};
	return {
		draggable: true,
		onDragStart: (e: React.DragEvent) => dnd.onDragStartDayPlan(p, e),
	};
}

// Index day plans by their YYYY-MM-DD date for O(1) per-day lookup.
export function indexDayPlans(plans: DayPlan[]): Map<string, DayPlan[]> {
	const map = new Map<string, DayPlan[]>();
	for (const p of plans) {
		(map.get(p.date) ?? map.set(p.date, []).get(p.date))?.push(p);
	}
	return map;
}

const RaceIcon = raceIcon;

export interface Race {
	id: unknown;
	date: string;
	name: string;
	distance_m: number | string | null;
	elevation_gain_m: number | string | null;
}

// Index races by their local YYYY-MM-DD date string.
export function indexRaces(races: Race[]): Map<string, Race[]> {
	const map = new Map<string, Race[]>();
	for (const r of races) {
		(map.get(r.date) ?? map.set(r.date, []).get(r.date))?.push(r);
	}
	return map;
}

export function DayRaces({
	day,
	byDay,
	activitiesByDay,
}: {
	day: Date;
	byDay?: Map<string, Race[]>;
	// When the race day already has a logged activity, the race is represented by
	// a laurel on that activity (DayEvent) instead of its own chip.
	activitiesByDay?: Map<string, CalendarActivity[]>;
}) {
	const races = byDay?.get(dayKey(day)) ?? [];
	if (races.length === 0) return null;
	if ((activitiesByDay?.get(dayKey(day))?.length ?? 0) > 0) return null;
	return (
		<>
			{races.map((r) => {
				const info = [
					num(r.distance_m) ? fmtDistance(num(r.distance_m)) : null,
					num(r.elevation_gain_m)
						? `${Math.round(num(r.elevation_gain_m))} m`
						: null,
				]
					.filter(Boolean)
					.join(" · ");
				return (
					<div
						key={String(r.id)}
						className="text-race border-race bg-race/10 flex flex-col rounded-md border-l-2 px-2 py-1.5 leading-tight"
						title={r.name}
					>
						<div className="flex items-center justify-center gap-1.5 md:justify-start">
							<RaceIcon size={16} className="shrink-0" />
							<span className="hidden truncate text-sm font-medium md:inline">
								{r.name}
							</span>
						</div>
						{info ? (
							<div className="text-muted-foreground hidden truncate text-xs md:block">
								{info}
							</div>
						) : null}
					</div>
				);
			})}
		</>
	);
}

const DayPlanDeleteIcon = iconifyIcon("mdi:close");
const DayPlanDragIcon = iconifyIcon("akar-icons:drag-vertical-fill");

function DayPlanChip({ p, isPast }: { p: DayPlan; isPast: boolean }) {
	const isMobile = useIsMobile();
	const dnd = useDayPlanDnd();
	const remove = useDeleteDayPlanMutation();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const Icon = sportIcon(p.sport);

	const deleteDayPlan = () => {
		if (remove.isPending) return;
		void (async () => {
			try {
				await remove.mutateAsync({ id: p.id });
				await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
			} catch {
				toast.error("Could not delete the plan");
			}
		})();
	};

	const chip = (
		<div
			{...dayPlanDragProps(dnd, p)}
			className={cn(
				"group/chip border-muted-foreground/40 bg-accent/40 hover:bg-accent text-muted-foreground flex items-start gap-1 rounded-md border-l-2 px-1.5 py-1 leading-tight transition-colors",
				dnd ? "md:cursor-grab md:active:cursor-grabbing" : "",
				isPast && "opacity-70",
			)}
			title={p.note}
		>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex min-w-0 flex-1 flex-col hover:opacity-80"
			>
				<span className="flex w-full items-center justify-center gap-1 md:justify-start">
					<Icon size={14} className="shrink-0" />
					<span className="hidden truncate text-xs font-medium md:inline">
						{p.note}
					</span>
				</span>
			</button>
			<button
				type="button"
				onClick={deleteDayPlan}
				disabled={remove.isPending}
				aria-label={`Delete ${p.note}`}
				className="text-destructive hidden shrink-0 opacity-0 transition-opacity hover:opacity-100 disabled:cursor-wait md:block md:group-hover/chip:opacity-70"
			>
				<DayPlanDeleteIcon size={14} className="shrink-0" />
			</button>
			{dnd ? (
				<DayPlanDragIcon
					size={14}
					aria-hidden="true"
					className="text-muted-foreground hidden shrink-0 opacity-0 transition-opacity md:block md:group-hover/chip:opacity-70"
				/>
			) : null}
		</div>
	);

	return (
		<>
			{chip}
			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent side={isMobile ? "bottom" : "right"} className="gap-0">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							<Icon size={18} className="shrink-0" />
							{p.sport ? cap(p.sport) : "Plan"}
						</SheetTitle>
						<SheetDescription>{p.date}</SheetDescription>
					</SheetHeader>
					<p className="text-muted-foreground px-4 text-sm">{p.note}</p>
					<SheetFooter>
						<Button
							variant="ghost"
							className="text-destructive"
							disabled={remove.isPending}
							onClick={deleteDayPlan}
						>
							Delete
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</>
	);
}

export function DayPlans({
	day,
	byDay,
}: {
	day: Date;
	byDay: Map<string, DayPlan[]>;
}) {
	const plans = byDay.get(dayKey(day)) ?? [];
	if (plans.length === 0) return null;
	const isPast = dayKey(day) < dayKey(new Date());
	const sortKey = (sport: string | null) =>
		sport ? CATEGORY_ORDER.indexOf(sport as Category) : -1;
	const ordered = [...plans].sort(
		(a, b) => sortKey(a.sport) - sortKey(b.sport),
	);
	return (
		<div className="mt-auto flex flex-col gap-1 pt-1">
			{ordered.map((p) => (
				<DayPlanChip key={String(p.id)} p={p} isPast={isPast} />
			))}
		</div>
	);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

export function eventInfo(a: CalendarActivity): string {
	const parts: string[] = [];
	const sub = effectiveSubtype(a.activity_type, a.subtype);
	if (sub) parts.push(cap(sub));
	if (num(a.distance_m)) parts.push(fmtDistance(num(a.distance_m)));
	if (num(a.duration_s)) parts.push(fmtDuration(num(a.duration_s)));
	return parts.join(" · ");
}

// Icon plus the numbers that matter: duration for everything, distance and
// vertical too when the activity is a run.
function compactInfo(a: CalendarActivity): string {
	const parts: string[] = [];
	if (num(a.duration_s)) parts.push(fmtDuration(num(a.duration_s)));
	if (categoryOf(a.activity_type, a.subtype) === "running") {
		if (num(a.distance_m)) parts.push(fmtDistance(num(a.distance_m)));
		if (num(a.elevation_gain_m))
			parts.push(`${Math.round(num(a.elevation_gain_m))} m`);
	}
	return parts.join(" · ");
}

export function DayEvent({
	a,
	isRace,
	compact,
}: {
	a: CalendarActivity;
	isRace?: boolean;
	compact?: boolean;
}) {
	const category = categoryOf(a.activity_type, a.subtype);
	const Icon = isRace ? RaceIcon : categoryIcon[category];
	const color = categoryColor[category];

	if (compact) {
		return (
			<Link
				to={`/activities/${a.id}`}
				title={a.name ?? a.activity_type ?? "Activity"}
				className={cn(
					"focus-visible:ring-ring flex items-center gap-1 rounded-md px-1.5 py-1 leading-tight transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none",
					isRace && "text-race bg-race/10",
				)}
				style={
					isRace
						? undefined
						: {
								color,
								backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
							}
				}
			>
				<Icon size={14} className="shrink-0" />
				<span className="hidden truncate text-xs font-medium tabular-nums md:inline">
					{compactInfo(a)}
				</span>
			</Link>
		);
	}

	return (
		<Link
			to={`/activities/${a.id}`}
			className={cn(
				"bg-accent/40 hover:bg-accent focus-visible:ring-ring rounded-md border-l-2 px-1.5 py-1 leading-tight transition-colors focus-visible:ring-2 focus-visible:outline-none",
				isRace && "text-race border-race",
			)}
			style={isRace ? undefined : { borderLeftColor: color }}
		>
			<div className="flex items-center justify-center gap-1 md:justify-start">
				<Icon size={14} className="shrink-0" />
				<span className="hidden truncate text-xs font-medium md:inline">
					{a.name ?? a.activity_type ?? "Activity"}
				</span>
			</div>
			<div
				className={cn(
					"hidden truncate text-xs md:block",
					isRace ? "text-race/80" : "text-muted-foreground",
				)}
			>
				{eventInfo(a)}
			</div>
		</Link>
	);
}

export function TotalRow({
	category,
	value,
	zero,
}: {
	category: Category;
	value: string;
	zero: boolean;
}) {
	const Icon = categoryIcon[category];
	return (
		<div className="flex items-center gap-1.5">
			<Icon
				size={12}
				className="shrink-0"
				style={{ color: categoryColor[category] }}
			/>
			<span
				className={cn(
					"text-xs font-semibold",
					zero && "text-muted-foreground font-normal",
				)}
			>
				{value}
			</span>
		</div>
	);
}

// Run/climb/strength totals for one week, matching the calendar's totals column.
export function WeekTotalsBlock({ totals }: { totals?: WeekTotals }) {
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-start gap-1.5">
				<categoryIcon.running
					size={12}
					className="mt-0.5 shrink-0"
					style={{ color: categoryColor.running }}
				/>
				<div className="leading-tight">
					<div
						className={cn(
							"text-xs font-semibold",
							!totals?.runKm && "text-muted-foreground font-normal",
						)}
					>
						{(totals?.runKm ?? 0).toFixed(1)} km
					</div>
					<div className="text-muted-foreground text-[11px]">
						{(totals?.runH ?? 0).toFixed(1)} h ·{" "}
						{Math.round(totals?.runVert ?? 0)} m
					</div>
				</div>
			</div>
			<TotalRow
				category="climbing"
				value={`${(totals?.climbH ?? 0).toFixed(1)} h`}
				zero={!totals?.climbH}
			/>
			<TotalRow
				category="strength"
				value={`${(totals?.weightsH ?? 0).toFixed(1)} h`}
				zero={!totals?.weightsH}
			/>
		</div>
	);
}

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
}: {
	weekStart: Date;
	byDay: Map<string, CalendarActivity[]>;
	dayPlansByDay?: Map<string, DayPlan[]>;
	racesByDay?: Map<string, Race[]>;
	totals?: WeekTotals;
	objectives?: WeekObjective[];
}) {
	const today = dayKey(new Date());
	const dnd = useDayPlanDnd();
	const showTotals = totals !== undefined || objectives !== undefined;
	const weekActivities = showTotals ? Array.from(byDay.values()).flat() : [];
	return (
		<div className="bg-card flex h-full overflow-hidden rounded-lg border">
			<div className="grid min-w-0 flex-1 grid-cols-7">
				{Array.from({ length: 7 }, (_, i) => i).map((i) => {
					const day = addDays(weekStart, i);
					const key = dayKey(day);
					const events = byDay.get(key) ?? [];
					const isToday = key === today;
					return (
						<div
							key={key}
							{...dayDropProps(dnd, day)}
							className="flex min-h-0 min-w-0 flex-col border-r last:border-r-0"
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
								<DayRaces
									day={day}
									byDay={racesByDay}
									activitiesByDay={byDay}
								/>
								{events.map((a) => (
									<DayEvent
										key={a.id}
										a={a}
										isRace={(racesByDay?.get(key)?.length ?? 0) > 0}
									/>
								))}
								{dayPlansByDay ? (
									<DayPlans day={day} byDay={dayPlansByDay} />
								) : null}
							</div>
						</div>
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
					<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
						<WeekTotalsBlock totals={totals} />
						{objectives ? (
							<WeekObjectives
								objectives={objectives}
								activities={weekActivities}
							/>
						) : null}
					</div>
				</aside>
			) : null}
		</div>
	);
}
