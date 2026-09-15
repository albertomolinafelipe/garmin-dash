import type React from "react";
import { Link } from "react-router-dom";

import { HoverPreview } from "@/components/hover-preview";

import { categoryColor, categoryIcon, categoryOf } from "@/lib/activity-types";
import { dayKey, fmtDistance, fmtDuration } from "@/lib/format";
import { raceIcon } from "@/lib/plans";
import { type CalendarActivity, num } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ActivityPreview } from "./activity-preview";
import { eventInfo, type Race } from "./model";

const RaceIcon = raceIcon;

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

// Icon plus the numbers that matter: duration for everything, distance and
// vertical too when the activity is a run.
function compactInfo(a: CalendarActivity): string {
	const parts: string[] = [];
	if (num(a.duration_s)) parts.push(fmtDuration(num(a.duration_s)));
	if (categoryOf(a.activity_type, a.subtype) === "running") {
		if (num(a.distance_m)) parts.push(fmtDistance(num(a.distance_m)));
		if (num(a.elevation_gain_m)) {
			parts.push(`${Math.round(num(a.elevation_gain_m))} m`);
		}
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
	// Only GPS activities get a hover preview — there is nothing to show without
	// a route, and this avoids a detail fetch for gym and indoor sessions.
	const withPreview = (trigger: React.ReactNode) =>
		a.start_lat == null ? (
			trigger
		) : (
			<HoverPreview content={() => <ActivityPreview id={a.id} />}>
				{trigger}
			</HoverPreview>
		);

	if (compact) {
		return withPreview(
			<Link
				to={`/activities/${a.id}`}
				title={a.name ?? a.activity_type ?? "Activity"}
				className={cn(
					"focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-1.5 py-1.5 leading-tight transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none",
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
				<Icon size={16} className="shrink-0" />
				<span className="hidden truncate text-sm font-medium tabular-nums md:inline">
					{compactInfo(a)}
				</span>
			</Link>,
		);
	}

	return withPreview(
		<Link
			to={`/activities/${a.id}`}
			className={cn(
				"bg-accent/40 hover:bg-accent focus-visible:ring-ring rounded-md border-l-2 px-2 py-1.5 leading-tight transition-colors focus-visible:ring-2 focus-visible:outline-none",
				isRace && "text-race border-race",
			)}
			style={isRace ? undefined : { borderLeftColor: color }}
		>
			<div className="flex items-center justify-center gap-1.5 md:justify-start">
				<Icon
					size={16}
					className="shrink-0"
					style={isRace ? undefined : { color }}
				/>
				<span className="hidden truncate text-sm font-medium md:inline">
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
		</Link>,
	);
}
