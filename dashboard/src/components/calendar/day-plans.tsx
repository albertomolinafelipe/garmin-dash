import {
	type Category,
	CATEGORY_ORDER,
	iconifyIcon,
} from "@/lib/activity-types";
import { dayKey } from "@/lib/format";
import { sportIcon } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { dayPlanDragProps, useDayPlanDnd } from "./dnd";
import type { DayPlan } from "./model";

const DragIcon = iconifyIcon("akar-icons:drag-vertical-fill");

// Ordering keeps a day's chips stable as plans are added; sportless plans first.
const sportRank = (sport: string | null) =>
	sport ? CATEGORY_ORDER.indexOf(sport as Category) : -1;

function DayPlanChip({
	plan,
	isPast,
	onEdit,
}: {
	plan: DayPlan;
	isPast: boolean;
	onEdit: (plan: DayPlan) => void;
}) {
	const dnd = useDayPlanDnd();
	const Icon = sportIcon(plan.sport);
	return (
		<div
			{...dayPlanDragProps(dnd, plan)}
			className={cn(
				"border-muted-foreground/40 bg-accent/40 text-muted-foreground group/chip flex items-start gap-1 rounded-md border-l-2 leading-tight transition-colors",
				dnd && "md:cursor-grab md:active:cursor-grabbing",
				isPast && "opacity-70",
			)}
			title={plan.note}
		>
			<button
				type="button"
				onClick={() => onEdit(plan)}
				className="hover:bg-accent flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5"
			>
				<Icon size={16} className="shrink-0" />
				<span className="hidden truncate text-sm font-medium md:inline">
					{plan.note}
				</span>
			</button>
			{dnd ? (
				<DragIcon
					size={16}
					aria-hidden="true"
					className="text-muted-foreground hidden shrink-0 self-center pr-1 opacity-0 transition-opacity md:block md:group-hover/chip:opacity-70"
				/>
			) : null}
		</div>
	);
}

export function DayPlans({
	day,
	byDay,
	onEdit,
}: {
	day: Date;
	byDay: Map<string, DayPlan[]>;
	onEdit: (plan: DayPlan) => void;
}) {
	const plans = byDay.get(dayKey(day)) ?? [];
	if (plans.length === 0) return null;
	const isPast = dayKey(day) < dayKey(new Date());
	const ordered = [...plans].sort(
		(a, b) => sportRank(a.sport) - sportRank(b.sport),
	);
	return (
		<div className="mt-auto flex flex-col gap-1 pt-1">
			{ordered.map((plan) => (
				<DayPlanChip
					key={String(plan.id)}
					plan={plan}
					isPast={isPast}
					onEdit={onEdit}
				/>
			))}
		</div>
	);
}
