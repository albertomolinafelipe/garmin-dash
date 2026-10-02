import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addWeeks, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	useDeleteWeekObjectiveMutation,
	useInsertWeekObjectiveMutation,
	useUpdateWeekObjectiveMutation,
	useWeekObjectivesQuery,
} from "@/graphql/hooks";
import { categoryColor } from "@/lib/activity-types";
import {
	type Metric,
	METRIC_META,
	currentIsoWeek,
	isoWeekStart,
	toIsoWeek,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

// Setting weekly distance/elevation targets one dialog at a time is slow when
// laying out a whole block of training, so this draws the next few weeks as
// draggable bars. Running only: it is what virtually every objective is for, and
// the calendar dialog still covers the occasional other sport.
const SPORT = "running";
const WEEKS_SHOWN = 12;

// Both lanes share a step count so one set of gridlines reads for both bars:
// every line is 10 km on the left bar and 500 m on the right.
const BASE_STEPS = 8;
const MAX_STEPS = 20;

// Matched to the running load panel in Analysis, so a target here is the same
// colour as the volume it is a target for.
const LANES = [
	{
		metric: "distance" as Metric,
		step: 10_000, // 10 km
		color: categoryColor.running,
		label: (base: number) => `${Math.round(base / 1000)}`,
	},
	{
		metric: "elevation" as Metric,
		step: 500, // 500 m
		color: "#D27E99",
		label: (base: number) => `${Math.round(base)}`,
	},
];

const cellKey = (week: string, metric: Metric) => `${week}|${metric}`;

const snap = (value: number, step: number) => Math.round(value / step) * step;

export function ObjectivePlanner() {
	const queryClient = useQueryClient();
	const { data: objectives } = useWeekObjectivesQuery();
	const insert = useInsertWeekObjectiveMutation();
	const update = useUpdateWeekObjectiveMutation();
	const remove = useDeleteWeekObjectiveMutation();

	const [anchor, setAnchor] = useState(currentIsoWeek);
	// Cells being dragged, and cells whose write is still in flight, so the bar
	// stays where it was dropped instead of snapping back until the refetch lands.
	const [pending, setPending] = useState<Map<string, number>>(new Map());
	const [steps, setSteps] = useState(BASE_STEPS);

	const trackRefs = useRef(new Map<string, HTMLDivElement>());
	const pendingRef = useRef(new Map<string, number>());
	const dragging = useRef<string | null>(null);

	const weeks = useMemo(() => {
		const start = isoWeekStart(anchor);
		return Array.from({ length: WEEKS_SHOWN }, (_, i) =>
			toIsoWeek(addWeeks(start, i)),
		);
	}, [anchor]);

	const thisWeek = currentIsoWeek();

	// One row per (week, metric) for running, so a cell can be matched back to the
	// row it has to update or delete.
	const stored = useMemo(() => {
		const map = new Map<string, { id: unknown; target: number }>();
		for (const o of objectives ?? []) {
			if (o.sport !== SPORT) continue;
			const key = cellKey(o.week, o.metric as Metric);
			if (!map.has(key)) map.set(key, { id: o.id, target: Number(o.target) });
		}
		return map;
	}, [objectives]);

	const valueOf = (week: string, metric: Metric) => {
		const key = cellKey(week, metric);
		return pending.get(key) ?? stored.get(key)?.target ?? 0;
	};

	// The axis has to clear whatever is already stored, otherwise an existing big
	// week would render clipped at the ceiling.
	const visibleSteps = useMemo(() => {
		let needed = steps;
		for (const lane of LANES) {
			for (const week of weeks) {
				const key = cellKey(week, lane.metric);
				const value = pending.get(key) ?? stored.get(key)?.target ?? 0;
				needed = Math.max(needed, Math.ceil(value / lane.step));
			}
		}
		return Math.min(MAX_STEPS, needed);
	}, [steps, weeks, pending, stored]);

	// Mirrored in a ref because a drag writes many times per frame and the commit
	// on release has to read the value that was actually dropped, not a stale one.
	const setCell = (week: string, metric: Metric, base: number) => {
		const key = cellKey(week, metric);
		if ((pendingRef.current.get(key) ?? stored.get(key)?.target ?? 0) === base) {
			return;
		}
		pendingRef.current.set(key, base);
		setPending(new Map(pendingRef.current));
	};

	// Let go of the optimistic value once the refetch has it, unless the cell moved
	// again while the write was in flight.
	const dropPending = (key: string, committed: number) => {
		if (pendingRef.current.get(key) !== committed) return;
		pendingRef.current.delete(key);
		setPending(new Map(pendingRef.current));
	};

	// Writes on release: one mutation per cell, chosen by what the cell was and
	// what it became. target > 0 is a CHECK constraint, so zero means "no
	// objective" and deletes the row.
	const commit = async (key: string) => {
		const target = pendingRef.current.get(key);
		const existing = stored.get(key);
		if (target === undefined) return;
		if (target === (existing?.target ?? 0)) {
			dropPending(key, target);
			return;
		}
		const [week, metric] = key.split("|");
		try {
			if (existing && target === 0) {
				await remove.mutateAsync({ id: existing.id });
			} else if (existing) {
				await update.mutateAsync({ id: existing.id, set: { target } });
			} else if (target > 0) {
				await insert.mutateAsync({
					object: { week, metric, target, sport: SPORT },
				});
			}
			await queryClient.invalidateQueries({ queryKey: ["week-objectives"] });
		} catch {
			toast.error("Could not save the objective");
		}
		dropPending(key, target);
	};

	// Map a pointer position onto a snapped target: the bar follows the cursor
	// rather than accumulating deltas, so short tracks stay precise.
	const applyPointer = (week: string, metric: Metric, clientY: number) => {
		const lane = LANES.find((l) => l.metric === metric);
		const track = trackRefs.current.get(cellKey(week, metric));
		if (!lane || !track) return;
		const rect = track.getBoundingClientRect();
		const raw =
			((rect.bottom - clientY) / rect.height) * visibleSteps * lane.step;
		// Pulling past the top raises the ceiling instead of sticking there.
		const wanted = Math.ceil(raw / lane.step);
		if (wanted > visibleSteps) setSteps(Math.min(MAX_STEPS, wanted));
		const ceiling = MAX_STEPS * lane.step;
		setCell(week, metric, Math.min(ceiling, Math.max(0, snap(raw, lane.step))));
	};

	const nudge = (week: string, metric: Metric, direction: number) => {
		const lane = LANES.find((l) => l.metric === metric);
		if (!lane) return;
		const next = Math.max(
			0,
			Math.min(
				MAX_STEPS * lane.step,
				valueOf(week, metric) + direction * lane.step,
			),
		);
		const wanted = Math.ceil(next / lane.step);
		if (wanted > visibleSteps) setSteps(Math.min(MAX_STEPS, wanted));
		setCell(week, metric, next);
		void commit(cellKey(week, metric));
	};

	// Releasing writes the bar that was being dragged; there is nothing to save.
	const endDrag = () => {
		const key = dragging.current;
		dragging.current = null;
		if (key) void commit(key);
	};

	const shift = (by: number) =>
		setAnchor(toIsoWeek(addWeeks(isoWeekStart(anchor), by)));

	// One tick per step, drawn from the bottom up and inset to the middle of the
	// bar, so a height can be read off without a full-width grid or an axis.
	const ticks = {
		backgroundImage: `repeating-linear-gradient(to top, var(--border) 0 1px, transparent 1px calc(100% / ${visibleSteps}))`,
		backgroundSize: "55% 100%",
		backgroundPosition: "center",
		backgroundRepeat: "no-repeat",
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Weekly objectives</CardTitle>
				<CardAction>
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							onClick={() => shift(-WEEKS_SHOWN)}
						>
							<ChevronLeft />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setAnchor(currentIsoWeek())}
						>
							Today
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={() => shift(WEEKS_SHOWN)}
						>
							<ChevronRight />
						</Button>
					</div>
				</CardAction>
			</CardHeader>
			<CardContent>
				{/* One plot, not one box per week: the columns are divided by rules so
				    a week still reads as its own slot. */}
				<div
					className="bg-muted/40 grid touch-none divide-x rounded-md border p-1"
					style={{
						gridTemplateColumns: `repeat(${WEEKS_SHOWN}, minmax(0, 1fr))`,
					}}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
				>
					{weeks.map((week) => {
						const current = week === thisWeek;
						return (
							<div
								key={week}
								className={cn(
									"flex flex-col items-center gap-2 px-0.5 py-1.5",
									current && "bg-accent/60",
								)}
							>
								<div className="flex h-40 items-end justify-center gap-2.5">
									{LANES.map((lane) => {
										const value = valueOf(week, lane.metric);
										const key = cellKey(week, lane.metric);
										const fraction = value / (visibleSteps * lane.step);
										return (
											<div
												key={lane.metric}
												ref={(el) => {
													if (el) trackRefs.current.set(key, el);
													else trackRefs.current.delete(key);
												}}
												role="slider"
												tabIndex={0}
												aria-label={`${METRIC_META[lane.metric].label} target for ${week}`}
												aria-valuemin={0}
												aria-valuemax={visibleSteps * lane.step}
												aria-valuenow={value}
												aria-valuetext={METRIC_META[lane.metric].format(value)}
												style={ticks}
												className="focus-visible:ring-ring/50 relative h-full w-3 cursor-ns-resize rounded-xs focus-visible:ring-2 focus-visible:outline-none"
												onPointerDown={(event) => {
													event.currentTarget.setPointerCapture(event.pointerId);
													dragging.current = key;
													applyPointer(week, lane.metric, event.clientY);
												}}
												onPointerMove={(event) => {
													if (dragging.current !== key) return;
													applyPointer(week, lane.metric, event.clientY);
												}}
												onKeyDown={(event) => {
													const by =
														event.key === "ArrowUp"
															? 1
															: event.key === "ArrowDown"
																? -1
																: 0;
													if (!by) return;
													event.preventDefault();
													nudge(week, lane.metric, by);
												}}
											>
												<div
													className="absolute inset-x-0 bottom-0 rounded-xs"
													style={{
														height: `${fraction * 100}%`,
														backgroundColor: lane.color,
													}}
												/>
											</div>
										);
									})}
								</div>

								<div className="flex flex-col items-center gap-0.5 text-sm leading-none font-medium whitespace-nowrap tabular-nums">
								{LANES.map((lane) => {
									const value = valueOf(week, lane.metric);
									return (
										<span
											key={lane.metric}
											style={{ color: value > 0 ? lane.color : undefined }}
											className={cn(value === 0 && "text-muted-foreground/40")}
										>
											{lane.label(value)} {METRIC_META[lane.metric].inputUnit}
										</span>
									);
									})}
								</div>
								<div
									className={cn(
										"text-muted-foreground text-center text-xs leading-tight whitespace-nowrap",
										current && "text-foreground font-medium",
									)}
								>
									<div>W{week.slice(-2)}</div>
									<div>{format(isoWeekStart(week), "d MMM")}</div>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
