import {
	type Category,
	CATEGORY_ORDER,
	categoryColor,
	categoryIcon,
	iconifyIcon,
	sportColor,
} from "@/lib/activity-types";
import { type Metric, METRIC_META, sportIcon } from "@/lib/plans";
import type { CalendarActivity } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { objectiveActual, type WeekObjective, type WeekTotals } from "./model";

const PlusIcon = iconifyIcon("mdi:plus");

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
			className="bg-primary/20 flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
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

const sportRank = (sport: string | null) =>
	sport ? CATEGORY_ORDER.indexOf(sport as Category) : -1;

// The week's objectives, each a progress bar against real activity totals.
// Objectives stack upward from the add button, which stays pinned at the bottom.
export function WeekObjectives({
	objectives,
	activities,
	onAdd,
	onEdit,
}: {
	objectives: WeekObjective[];
	activities: CalendarActivity[];
	onAdd: () => void;
	onEdit: (objective: WeekObjective) => void;
}) {
	const ordered = [...objectives].sort(
		(a, b) => sportRank(a.sport) - sportRank(b.sport),
	);
	return (
		<div className="mt-auto flex flex-col gap-1.5 pt-1.5">
			{ordered.map((o) => {
				const meta = METRIC_META[o.metric as Metric];
				const target = Number(o.target);
				const actual = objectiveActual(activities, o.metric, o.sport);
				const SportIcon = sportIcon(o.sport);
				const MetricIcon = meta?.icon;
				return (
					<button
						key={String(o.id)}
						type="button"
						onClick={() => onEdit(o)}
						className="hover:bg-accent/60 flex items-center gap-1.5 rounded px-0.5 py-0.5 transition-colors"
					>
						<ObjectiveBar
							sport={o.sport}
							metric={o.metric}
							target={target}
							actual={actual}
						/>
						<span className="text-muted-foreground flex w-24 shrink-0 items-center gap-1 text-xs tabular-nums">
							<SportIcon size={13} className="shrink-0" />
							{MetricIcon ? (
								<MetricIcon size={13} className="shrink-0" />
							) : null}
							<span className="truncate">
								{meta ? meta.format(target) : ""}
							</span>
						</span>
					</button>
				);
			})}
			<button
				type="button"
				onClick={onAdd}
				aria-label="Add objective"
				className="bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground flex w-full items-center justify-center rounded py-1 transition-colors"
			>
				<PlusIcon size={14} />
			</button>
		</div>
	);
}

// One week's cell in the totals column: totals on top, the week note in the
// middle, objectives pinned to the bottom. Clicking empty space edits the note.
export function WeekNotePreview({ note }: { note?: string }) {
	if (!note) return null;
	return (
		<p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-snug italic">
			{note}
		</p>
	);
}
