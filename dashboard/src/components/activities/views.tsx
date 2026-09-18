import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	categoryColor,
	categoryIcon,
	categoryOf,
	needsAnnotation,
	typeLabel,
} from "@/lib/activity-types";
import { fmtDay, fmtDistance, fmtDuration } from "@/lib/format";
import {
	num,
	raceForStartTime,
	type RaceRef,
	useActivity,
	useActivitySamples,
	type CalendarActivity,
} from "@/lib/queries";
import { buildSamplePoints } from "@/lib/samples";
import { raceIcon as RaceIcon } from "@/lib/plans";

const RoutePreviewMap = lazy(() =>
	import("@/components/calendar/route-preview-map").then((m) => ({
		default: m.RoutePreviewMap,
	})),
);

export const CARDS_PER_PAGE = 12;

interface ViewProps {
	activities: CalendarActivity[];
	racesByDay: Map<string, RaceRef[]>;
}

function useOpenActivity() {
	const navigate = useNavigate();
	return (id: unknown) => navigate(`/activities/${String(id)}`);
}

function vert(activity: CalendarActivity) {
	const value = num(activity.elevation_gain_m);
	return value ? `${Math.round(value)} m` : "—";
}

function Flags({
	activity,
	racesByDay,
}: {
	activity: CalendarActivity;
	racesByDay: Map<string, RaceRef[]>;
}) {
	return (
		<>
			{raceForStartTime(racesByDay, activity.start_time) ? (
				<RaceIcon className="text-race size-4 shrink-0" aria-label="Race" />
			) : null}
			{needsAnnotation(activity) ? (
				<Badge variant="outline" className="shrink-0 text-[10px]">
					Needs annotation
				</Badge>
			) : null}
		</>
	);
}

export function ActivityTable({ activities, racesByDay }: ViewProps) {
	const open = useOpenActivity();
	return (
		<table className="w-full text-sm">
			<thead className="bg-card sticky top-0 z-10 border-b">
				<tr className="text-muted-foreground text-left">
					<th className="w-3 py-3" aria-label="Category" />
					<th className="px-4 py-3 font-medium">Date</th>
					<th className="px-4 py-3 font-medium">Name</th>
					<th className="hidden px-4 py-3 font-medium md:table-cell">Type</th>
					<th className="hidden px-4 py-3 text-right font-medium md:table-cell">
						Distance
					</th>
					<th className="hidden px-4 py-3 text-right font-medium md:table-cell">
						Duration
					</th>
					<th className="hidden px-4 py-3 text-right font-medium md:table-cell">
						Elevation
					</th>
				</tr>
			</thead>
			<tbody className="divide-y">
				{activities.map((activity) => {
					const category = categoryOf(activity.activity_type, activity.subtype);
					return (
						<tr
							key={String(activity.id)}
							className="hover:bg-muted/50 cursor-pointer transition-colors"
							tabIndex={0}
							onClick={() => open(activity.id)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") open(activity.id);
							}}
						>
							<td className="py-3">
								<div
									className="mx-auto h-6 w-1 rounded-full"
									style={{ backgroundColor: categoryColor[category] }}
								/>
							</td>
							<td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
								{fmtDay(activity.start_time)}
							</td>
							<td className="max-w-[60vw] px-4 py-3 font-medium md:max-w-72">
								<div className="flex min-w-0 items-center gap-2">
									<span className="truncate">{activity.name ?? "—"}</span>
									<Flags activity={activity} racesByDay={racesByDay} />
								</div>
							</td>
							<td className="hidden px-4 py-3 md:table-cell">
								{typeLabel(activity.activity_type, activity.subtype)}
							</td>
							<td className="hidden px-4 py-3 text-right tabular-nums whitespace-nowrap md:table-cell">
								{fmtDistance(num(activity.distance_m))}
							</td>
							<td className="hidden px-4 py-3 text-right tabular-nums whitespace-nowrap md:table-cell">
								{fmtDuration(num(activity.duration_s))}
							</td>
							<td className="hidden px-4 py-3 text-right tabular-nums whitespace-nowrap md:table-cell">
								{vert(activity)}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

// Route thumbnails are real Leaflet maps, so this view is paged: a full history
// of cards would mount hundreds of them at once.
export function ActivityCards({
	activities,
	racesByDay,
	page,
	onPageChange,
}: ViewProps & { page: number; onPageChange: (page: number) => void }) {
	const open = useOpenActivity();
	const pages = Math.max(1, Math.ceil(activities.length / CARDS_PER_PAGE));
	const current = Math.min(page, pages - 1);
	const slice = activities.slice(
		current * CARDS_PER_PAGE,
		current * CARDS_PER_PAGE + CARDS_PER_PAGE,
	);

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{slice.map((activity) => {
					const category = categoryOf(activity.activity_type, activity.subtype);
					const Icon = categoryIcon[category];
					return (
						<button
							key={String(activity.id)}
							type="button"
							onClick={() => open(activity.id)}
							className="bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-xl border text-left transition-colors"
						>
							{activity.start_lat == null ? (
								<div
									className="h-32"
									style={{ backgroundColor: `${categoryColor[category]}18` }}
								/>
							) : (
								<Suspense fallback={<div className="bg-muted h-32" />}>
									<CardMap id={String(activity.id)} />
								</Suspense>
							)}
							<div className="flex flex-col gap-1 p-3">
								<div className="flex min-w-0 items-center gap-2">
									<Icon
										size={16}
										className="shrink-0"
										style={{ color: categoryColor[category] }}
									/>
									<span className="truncate text-sm font-medium">
										{activity.name ?? "—"}
									</span>
									<Flags activity={activity} racesByDay={racesByDay} />
								</div>
								<span className="text-muted-foreground truncate text-xs">
									{fmtDay(activity.start_time)}
								</span>
								<div className="text-muted-foreground mt-1 flex gap-3 text-xs tabular-nums">
									<span>{fmtDistance(num(activity.distance_m))}</span>
									<span>{fmtDuration(num(activity.duration_s))}</span>
									<span>{vert(activity)}</span>
								</div>
							</div>
						</button>
					);
				})}
			</div>
			<div className="flex items-center justify-center gap-3 text-sm">
				<Button
					variant="outline"
					size="sm"
					disabled={current === 0}
					onClick={() => onPageChange(current - 1)}
				>
					Previous
				</Button>
				<span className="text-muted-foreground tabular-nums">
					{current + 1} / {pages}
				</span>
				<Button
					variant="outline"
					size="sm"
					disabled={current >= pages - 1}
					onClick={() => onPageChange(current + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	);
}

// Split out so a card's track queries only run when it mounts. Older activities
// carry a stream payload; newer ones only have full-resolution samples, so fall
// back to those rather than showing an empty thumbnail.
function CardMap({ id }: { id: string }) {
	const { data } = useActivity(id);
	const streamTrack = data?.activity_streams[0]?.payload?.track ?? [];
	const { data: samplesData } = useActivitySamples(
		data && streamTrack.length < 2 ? id : undefined,
	);
	const track =
		streamTrack.length > 1
			? streamTrack
			: buildSamplePoints(samplesData?.activity_samples ?? []).track;
	if (track.length < 2) return <div className="bg-muted h-32" />;
	return <RoutePreviewMap track={track} className="h-32" />;
}
