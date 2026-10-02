import { Link } from "react-router-dom";

import { categoryColor, categoryIcon, categoryOf } from "@/lib/activity-types";
import type { CalendarActivity } from "@/lib/queries";
import { ActivityPreview } from "./activity-preview";
import { eventInfo } from "./model";

// One tappable row per activity, for days holding more than one session.
function ActivityRow({ a }: { a: CalendarActivity }) {
	const category = categoryOf(a.activity_type, a.subtype);
	const Icon = categoryIcon[category];
	return (
		<Link
			to={`/activities/${a.id}`}
			className="hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 leading-tight transition-colors focus-visible:ring-2 focus-visible:outline-none"
		>
			<Icon
				size={16}
				className="shrink-0"
				style={{ color: categoryColor[category] }}
			/>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">
					{a.name ?? a.activity_type ?? "Activity"}
				</div>
				<div className="text-muted-foreground truncate text-xs">
					{eventInfo(a)}
				</div>
			</div>
		</Link>
	);
}

// What a day's dot stands for, as a card: a single session shows its route and
// headline numbers, several show a list to pick from. Both lead to the activity
// page.
export function DayActivitiesPreview({
	day,
	activities,
}: {
	day: Date;
	activities: CalendarActivity[];
}) {
	const heading = day.toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "long",
	});

	if (activities.length === 1) {
		return (
			<Link to={`/activities/${activities[0].id}`} className="block">
				<ActivityPreview id={activities[0].id} showProfile={false} />
			</Link>
		);
	}

	return (
		<div className="flex flex-col gap-1 p-2">
			<div className="text-muted-foreground px-2 pt-1 text-[10px] font-medium tracking-wide uppercase">
				{heading}
			</div>
			{activities.map((a) => (
				<ActivityRow key={a.id} a={a} />
			))}
		</div>
	);
}
