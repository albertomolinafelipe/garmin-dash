import { lazy, Suspense } from "react";

import { categoryColor, categoryIcon, categoryOf } from "@/lib/activity-types";
import { fmtDistance, fmtDuration } from "@/lib/format";
import { num, useActivity } from "@/lib/queries";
import { eventInfo } from "./model";

// Leaflet drags in its own CSS bundle, so keep it out of the main chunk: the
// preview is the only calendar surface that needs a map.
const RoutePreviewMap = lazy(() =>
	import("./route-preview-map").then((m) => ({ default: m.RoutePreviewMap })),
);

// Recharts is large and the calendar itself never charts anything, so keep the
// profile out of the calendar chunk too.
const ElevationSparkline = lazy(() =>
	import("./elevation-sparkline").then((m) => ({
		default: m.ElevationSparkline,
	})),
);

const PREVIEW_HEIGHT = "h-40";
const PROFILE_HEIGHT = "h-16";

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col">
			<span className="text-muted-foreground text-[10px] tracking-wide uppercase">
				{label}
			</span>
			<span className="text-sm font-semibold tabular-nums">{value}</span>
		</div>
	);
}

// Hover body for a calendar activity: its route when the activity has GPS,
// plus the headline numbers. Mounted only while the card is open, so the detail
// query and the map bundle are both deferred until hover.
export function ActivityPreview({ id }: { id: string }) {
	const { data: activity, isPending } = useActivity(id);

	if (isPending) {
		return (
			<div
				className={`text-muted-foreground flex ${PREVIEW_HEIGHT} items-center justify-center text-sm`}
			>
				Loading…
			</div>
		);
	}
	if (!activity) return null;

	const category = categoryOf(activity.activity_type, activity.subtype);
	const Icon = categoryIcon[category];
	const track = activity.activity_streams[0]?.payload?.track ?? [];
	const profile = activity.activity_streams[0]?.payload?.elevation ?? [];
	const distance = num(activity.distance_m);
	const duration = num(activity.duration_s);
	const elevation = num(activity.elevation_gain_m);

	return (
		<div className="flex flex-col">
			{track.length > 1 ? (
				<Suspense
					fallback={
						<div
							className={`text-muted-foreground flex ${PREVIEW_HEIGHT} items-center justify-center text-sm`}
						>
							Loading map…
						</div>
					}
				>
					<RoutePreviewMap track={track} className={PREVIEW_HEIGHT} />
				</Suspense>
			) : null}
			<div className="flex flex-col gap-2 p-3">
				<div className="flex items-center gap-2">
					<Icon
						size={16}
						className="shrink-0"
						style={{ color: categoryColor[category] }}
					/>
					<span className="truncate text-sm font-medium">
						{activity.name ?? activity.activity_type ?? "Activity"}
					</span>
				</div>
				{distance || duration || elevation ? (
					<div className="flex gap-4">
						{distance ? (
							<Stat label="Distance" value={fmtDistance(distance)} />
						) : null}
						{duration ? (
							<Stat label="Time" value={fmtDuration(duration)} />
						) : null}
						{elevation ? (
							<Stat label="Vert" value={`${Math.round(elevation)} m`} />
						) : null}
					</div>
				) : (
					<span className="text-muted-foreground text-xs">
						{eventInfo(activity)}
					</span>
				)}
			</div>
			{/* Flush to the card's side and bottom edges: the rounded corners come
			    from the popover, which clips it. */}
			{profile.length > 1 ? (
				<Suspense fallback={<div className={PROFILE_HEIGHT} />}>
					<ElevationSparkline
						elevation={profile}
						className={`${PROFILE_HEIGHT} w-full`}
					/>
				</Suspense>
			) : null}
		</div>
	);
}
