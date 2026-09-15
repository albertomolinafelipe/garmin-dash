import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
	Bolt,
	Check,
	Clock3,
	Flame,
	Gauge,
	Heart,
	Mountain,
	Route,
} from "lucide-react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Link, useParams } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, TileLayer } from "react-leaflet";

import "@/lib/leaflet-gesture";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "recharts";

import { DaySleepPanel } from "@/components/day-sleep-panel";
import { ClimbingAnnotation } from "@/components/annotations/ClimbingAnnotation";
import { RunningAnnotation } from "@/components/annotations/RunningAnnotation";
import { ShoeField } from "@/components/annotations/shoe-field";
import { StrengthAnnotation } from "@/components/annotations/StrengthAnnotation";
import { useAnnotationSave } from "@/components/annotations/use-annotation-save";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const TerrainRouteMap = lazy(() =>
	import("@/components/TerrainRouteMap").then((m) => ({
		default: m.TerrainRouteMap,
	})),
);
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { useFoodOptionsQuery } from "@/graphql/hooks";
import {
	categoryColor,
	categoryIcon,
	categoryOf,
	effectiveSubtype,
	needsAnnotation,
	SHOE_CUTOFF,
} from "@/lib/activity-types";
import { dayKey, fmtDate, fmtDistance, fmtDuration } from "@/lib/format";
import {
	STADIA_ATTRIBUTION,
	STADIA_MAX_ZOOM,
	STADIA_SATELLITE_TILE_URL,
} from "@/lib/map-tiles";
import { cn } from "@/lib/utils";
import {
	type ActivityDetail as Activity,
	type StreamSample,
	num,
	raceForStartTime,
	useActivity,
	useActivitySamples,
	useRacesByDay,
} from "@/lib/queries";
import { type SamplePoint, buildSamplePoints } from "@/lib/samples";
import { raceIcon as RaceIcon } from "@/lib/plans";

const HR = "#E46876";
const ELEVATION = "#7AA89F";

function formatPace(speed: number): string {
	if (!speed) return "—";
	const seconds = 1000 / speed;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")} /km`;
}

function elapsed(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return hours ? `${hours}:${String(minutes).padStart(2, "0")}` : `${minutes}m`;
}

interface Metric {
	label: string;
	value: string;
	icon: typeof Route;
}

function Metrics({ activity }: { activity: Activity }) {
	const metrics = (
		[
			num(activity.distance_m)
				? {
						label: "Distance",
						value: fmtDistance(num(activity.distance_m)),
						icon: Route,
					}
				: null,
			num(activity.duration_s)
				? {
						label: "Duration",
						value: fmtDuration(num(activity.duration_s)),
						icon: Clock3,
					}
				: null,
			num(activity.avg_speed_mps)
				? {
						label: "Average pace",
						value: formatPace(num(activity.avg_speed_mps)),
						icon: Gauge,
					}
				: null,
			activity.avg_hr
				? { label: "Average HR", value: `${activity.avg_hr} bpm`, icon: Heart }
				: null,
			activity.max_hr
				? { label: "Maximum HR", value: `${activity.max_hr} bpm`, icon: Heart }
				: null,
			num(activity.elevation_gain_m)
				? {
						label: "Elevation gain",
						value: `${Math.round(num(activity.elevation_gain_m))} m`,
						icon: Mountain,
					}
				: null,
			activity.calories
				? { label: "Calories", value: `${activity.calories} kcal`, icon: Flame }
				: null,
			num(activity.avg_power_w)
				? {
						label: "Average power",
						value: `${Math.round(num(activity.avg_power_w))} W`,
						icon: Bolt,
					}
				: null,
		] satisfies (Metric | null)[]
	).filter((metric): metric is Metric => metric !== null);

	const color =
		categoryColor[categoryOf(activity.activity_type, activity.subtype)];
	return (
		<div className="grid w-full grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
			{metrics.map((metric) => (
				<div key={metric.label} className="flex min-w-0 items-center gap-3">
					<div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
						<metric.icon className="size-5" style={{ color }} />
					</div>
					<div className="min-w-0">
						<div className="truncate font-semibold tabular-nums">
							{metric.value}
						</div>
						<div className="text-muted-foreground truncate text-xs">
							{metric.label}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

function RouteMap({
	track,
	marker,
}: {
	track: { lat: number; lng: number }[];
	marker?: { lat: number; lng: number } | null;
}) {
	const [mode, setMode] = useState<"2d" | "3d">("2d");
	const positions: LatLngExpression[] = track.map((point) => [
		point.lat,
		point.lng,
	]);
	const bounds = positions as LatLngBoundsExpression;

	return (
		<Card className="flex h-full flex-col gap-3 overflow-hidden py-4">
			<CardHeader className="flex flex-row items-center justify-between px-4">
				<CardTitle className="text-sm">Route</CardTitle>
				<ToggleGroup
					type="single"
					value={mode}
					onValueChange={(value) => value && setMode(value as "2d" | "3d")}
					variant="outline"
					size="sm"
				>
					<ToggleGroupItem value="2d">2D</ToggleGroupItem>
					<ToggleGroupItem value="3d">3D</ToggleGroupItem>
				</ToggleGroup>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 px-4">
				<div className="isolate h-full min-h-[320px] overflow-hidden rounded-lg border">
					{mode === "3d" ? (
						<Suspense
							fallback={
								<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
									Loading 3D terrain…
								</div>
							}
						>
							<TerrainRouteMap track={track} marker={marker} />
						</Suspense>
					) : (
						<MapContainer
							bounds={bounds}
							boundsOptions={{ padding: [20, 20] }}
							gestureHandling
							className="route-map h-full w-full"
						>
							<TileLayer
								url={STADIA_SATELLITE_TILE_URL}
								detectRetina
								maxNativeZoom={STADIA_MAX_ZOOM}
								attribution={STADIA_ATTRIBUTION}
								zIndex={1}
							/>
							<Polyline
								positions={positions}
								pathOptions={{ color: "#E46876", weight: 4, opacity: 0.95 }}
							/>
							{marker && (
								<CircleMarker
									center={[marker.lat, marker.lng]}
									radius={6}
									pathOptions={{
										color: "#fff",
										weight: 2,
										fillColor: "#E46876",
										fillOpacity: 1,
									}}
								/>
							)}
						</MapContainer>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function mergeStreams(hr: StreamSample[], elevation: StreamSample[]) {
	const points = new Map<
		number,
		{ t: number; hr?: number; elevation?: number }
	>();
	for (const sample of hr) points.set(sample.t, { t: sample.t, hr: sample.v });
	for (const sample of elevation) {
		const point = points.get(sample.t) ?? { t: sample.t };
		point.elevation = sample.v;
		points.set(sample.t, point);
	}
	return [...points.values()].sort((a, b) => a.t - b.t);
}

const streamConfig = {
	hr: { label: "Heart rate", color: HR },
	elevation: { label: "Elevation", color: ELEVATION },
} satisfies ChartConfig;

function StreamChart({
	hr,
	elevation,
	onHover,
}: {
	hr: StreamSample[];
	elevation: StreamSample[];
	onHover?: (t: number | null) => void;
}) {
	const rows = useMemo(() => mergeStreams(hr, elevation), [hr, elevation]);
	const hasHr = hr.length > 0;
	const hasElevation = elevation.length > 0;
	return (
		<Card className="gap-3 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">
					{hasElevation ? "Heart rate & elevation" : "Heart rate"}
				</CardTitle>
			</CardHeader>
			<CardContent className="h-[296px] px-4 pb-1">
				<ChartContainer
					config={streamConfig}
					className="aspect-auto h-full w-full"
				>
					<ComposedChart
						data={rows}
						margin={{ top: 5, right: 2, left: 0 }}
						onMouseMove={(state) => {
							const label = state?.activeLabel;
							onHover?.(label == null ? null : Number(label));
						}}
						onMouseLeave={() => onHover?.(null)}
					>
						<defs>
							<linearGradient
								id="activity-elevation"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop offset="0%" stopColor={ELEVATION} stopOpacity={0.35} />
								<stop offset="100%" stopColor={ELEVATION} stopOpacity={0.03} />
							</linearGradient>
							<linearGradient id="activity-hr" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={HR} stopOpacity={0.3} />
								<stop offset="100%" stopColor={HR} stopOpacity={0.03} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" vertical={false} />
						<XAxis
							dataKey="t"
							tickFormatter={elapsed}
							tickLine={false}
							axisLine={false}
							minTickGap={35}
						/>
						<YAxis
							yAxisId="hr"
							width={34}
							tickLine={false}
							axisLine={false}
							hide={!hasHr}
						/>
						<YAxis
							yAxisId="elevation"
							orientation="right"
							width={38}
							tickLine={false}
							axisLine={false}
							hide={!hasElevation}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									hideLabel
									formatter={(value, name) => {
										if (value == null || Number.isNaN(Number(value)))
											return null;
										const isHr = name === "hr" || name === "Heart rate";
										return (
											<div className="flex w-full items-center justify-between gap-4">
												<span className="text-muted-foreground">
													{isHr ? "Heart rate" : "Elevation"}
												</span>
												<span className="text-foreground font-mono font-medium tabular-nums">
													{Math.round(Number(value))} {isHr ? "bpm" : "m"}
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						{hasElevation && (
							<Area
								yAxisId="elevation"
								type="monotone"
								dataKey="elevation"
								stroke={ELEVATION}
								fill="url(#activity-elevation)"
								dot={false}
								connectNulls
							/>
						)}
						{hasHr &&
							(hasElevation ? (
								<Line
									yAxisId="hr"
									type="monotone"
									dataKey="hr"
									stroke={HR}
									strokeWidth={2}
									dot={false}
									connectNulls
								/>
							) : (
								<Area
									yAxisId="hr"
									type="monotone"
									dataKey="hr"
									stroke={HR}
									fill="url(#activity-hr)"
									strokeWidth={2}
									dot={false}
									connectNulls
								/>
							))}
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

// Heart rate and elevation against distance (km), from full-resolution samples.
function SampleChart({
	points,
	hasHr,
	hasElevation,
	onHover,
}: {
	points: SamplePoint[];
	hasHr: boolean;
	hasElevation: boolean;
	onHover?: (index: number | null) => void;
}) {
	return (
		<Card className="gap-3 py-4">
			<CardHeader className="px-4">
				<CardTitle className="text-sm">
					{hasElevation ? "Heart rate & elevation" : "Heart rate"}
				</CardTitle>
			</CardHeader>
			<CardContent className="h-[296px] px-4 pb-1">
				<ChartContainer config={streamConfig} className="aspect-auto h-full w-full">
					<ComposedChart
						data={points}
						margin={{ top: 5, right: 2, left: 0 }}
						onMouseMove={(state) =>
							onHover?.(
								typeof state?.activeTooltipIndex === "number"
									? state.activeTooltipIndex
									: null,
							)
						}
						onMouseLeave={() => onHover?.(null)}
					>
						<defs>
							<linearGradient id="activity-elevation" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={ELEVATION} stopOpacity={0.35} />
								<stop offset="100%" stopColor={ELEVATION} stopOpacity={0.03} />
							</linearGradient>
							<linearGradient id="activity-hr" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={HR} stopOpacity={0.3} />
								<stop offset="100%" stopColor={HR} stopOpacity={0.03} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" vertical={false} />
						<XAxis
							dataKey="d"
							type="number"
							domain={[0, "dataMax"]}
							tickFormatter={(d) => `${Number(d).toFixed(1)}`}
							tickLine={false}
							axisLine={false}
							minTickGap={35}
							unit=" km"
						/>
						<YAxis
							yAxisId="hr"
							width={34}
							tickLine={false}
							axisLine={false}
							hide={!hasHr}
						/>
						<YAxis
							yAxisId="elevation"
							orientation="right"
							width={38}
							tickLine={false}
							axisLine={false}
							hide={!hasElevation}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) => {
										const d = payload?.[0]?.payload?.d;
										return d == null ? "" : `${Number(d).toFixed(2)} km`;
									}}
									formatter={(value, name) => {
										if (value == null || Number.isNaN(Number(value)))
											return null;
										const isHr = name === "hr" || name === "Heart rate";
										return (
											<div className="flex w-full items-center justify-between gap-4">
												<span className="text-muted-foreground">
													{isHr ? "Heart rate" : "Elevation"}
												</span>
												<span className="text-foreground font-mono font-medium tabular-nums">
													{Math.round(Number(value))} {isHr ? "bpm" : "m"}
												</span>
											</div>
										);
									}}
								/>
							}
						/>
						{hasElevation && (
							<Area
								yAxisId="elevation"
								type="monotone"
								dataKey="elevation"
								stroke={ELEVATION}
								fill="url(#activity-elevation)"
								dot={false}
								connectNulls
							/>
						)}
						{hasHr &&
							(hasElevation ? (
								<Line
									yAxisId="hr"
									type="monotone"
									dataKey="hr"
									stroke={HR}
									strokeWidth={2}
									dot={false}
									connectNulls
								/>
							) : (
								<Area
									yAxisId="hr"
									type="monotone"
									dataKey="hr"
									stroke={HR}
									fill="url(#activity-hr)"
									strokeWidth={2}
									dot={false}
									connectNulls
								/>
							))}
					</ComposedChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}

function EditableName({
	activity,
	onSave,
}: {
	activity: Activity;
	onSave: ReturnType<typeof useAnnotationSave>;
}) {
	const [name, setName] = useState(activity.name ?? "");
	const dirty = useRef(false);

	useEffect(() => {
		if (!dirty.current) setName(activity.name ?? "");
	}, [activity.name]);

	const isDirty = name !== (activity.name ?? "");
	const confirm = async () => {
		if (!isDirty) return;
		const saved = await onSave({ name: name.trim() ? name : null });
		if (saved) dirty.current = false;
	};

	return (
		<div className="flex min-w-0 items-center gap-2">
			<Input
				aria-label="Activity name"
				className="border-muted-foreground/40 hover:border-muted-foreground/70 focus-visible:border-primary h-auto rounded-none border-0 border-b border-dashed px-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-xl"
				value={name}
				placeholder="Activity name"
				title="Click to edit name"
				onChange={(event) => {
					dirty.current = true;
					setName(event.target.value);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") void confirm();
				}}
			/>
			{isDirty && (
				<Button
					type="button"
					size="sm"
					aria-label="Confirm name"
					onClick={() => void confirm()}
					className="shrink-0"
				>
					<Check className="size-4" />
					Save
				</Button>
			)}
		</div>
	);
}

export function ActivityDetail() {
	const { id } = useParams();
	const { data: activity, isPending, isError } = useActivity(id);
	const foodOptions =
		useFoodOptionsQuery().data?.food_options.flatMap((option) =>
			option.value == null ? [] : [option.value],
		) ?? [];
	const save = useAnnotationSave(id ?? "");
	const racesByDay = useRacesByDay();
	const [hoverT, setHoverT] = useState<number | null>(null);
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);
	const { data: samplesData } = useActivitySamples(id);
	const sample = useMemo(
		() => buildSamplePoints(samplesData?.activity_samples ?? []),
		[samplesData],
	);

	if (isPending)
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
				Loading activity…
			</div>
		);
	if (isError || !activity)
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<p className="text-muted-foreground text-sm">Activity not found.</p>
				<Button variant="outline" asChild>
					<Link to="/activities">Back to activities</Link>
				</Button>
			</div>
		);

	const category = categoryOf(activity.activity_type, activity.subtype);

	// Prefer full-resolution samples (distance-scaled chart, full-detail track);
	// fall back to the legacy stream payload for activities predating them.
	const useSamples = sample.points.length > 0;
	const payload = activity.activity_streams[0]?.payload ?? {};
	const streamHr = payload.hr ?? [];
	const streamElevation = payload.elevation ?? [];

	const track = useSamples ? sample.track : (payload.track ?? []);
	const hasChart = useSamples
		? sample.hasHr || sample.hasElevation
		: streamHr.length > 0 || streamElevation.length > 0;

	let hoverMarker: { lat: number; lng: number } | null = null;
	if (useSamples) {
		const point = hoverIdx == null ? null : sample.points[hoverIdx];
		hoverMarker =
			point?.lat != null && point.lng != null
				? { lat: point.lat, lng: point.lng }
				: null;
	} else {
		// Stream points carry no timestamps, so approximate the hovered fix by
		// mapping the hovered elapsed time onto the thinned track by fraction.
		const maxT = Math.max(
			streamHr.at(-1)?.t ?? 0,
			streamElevation.at(-1)?.t ?? 0,
		);
		hoverMarker =
			hoverT != null && track.length > 0 && maxT > 0
				? (track[
						Math.min(
							track.length - 1,
							Math.max(0, Math.round((hoverT / maxT) * (track.length - 1))),
						)
					] ?? null)
				: null;
	}

	return (
		<div className="space-y-4 p-4">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
				<div className="grid flex-1 gap-4 sm:grid-cols-3 lg:min-h-[13rem]">
				<Card
					className="justify-center gap-3 border-l-4 py-4 sm:col-span-1"
					style={{ borderLeftColor: categoryColor[category] }}
				>
					<CardHeader className="px-4">
						<CardTitle>
							<EditableName
								key={String(activity.id)}
								activity={activity}
								onSave={save}
							/>
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-wrap items-center gap-2 px-4">
						<span className="text-foreground text-base font-medium">
							{fmtDate(activity.start_time)}
						</span>
						{(() => {
							const Icon = categoryIcon[category];
							const sub = effectiveSubtype(
								activity.activity_type,
								activity.subtype,
							);
							return (
								<span className="flex items-center gap-1.5">
									<Icon size={30} style={{ color: categoryColor[category] }} />
									{sub && (
										<span className="text-muted-foreground text-xs tracking-wide uppercase">
											{sub}
										</span>
									)}
								</span>
							);
						})()}
						{(() => {
							const race = raceForStartTime(racesByDay, activity.start_time);
							return race ? (
								<Badge
									variant="outline"
									className="text-race border-race gap-1"
								>
									<RaceIcon className="size-3.5" />
									{race.name}
								</Badge>
							) : null;
						})()}
						{needsAnnotation(activity) && (
							<Badge variant="secondary">needs annotation</Badge>
						)}
					</CardContent>
				</Card>
				<Card className="justify-center py-4 sm:col-span-2">
					<CardContent className="flex items-center px-4">
						<Metrics activity={activity} />
					</CardContent>
				</Card>
				</div>
				{activity.start_time && (
					<DaySleepPanel
						date={dayKey(new Date(activity.start_time))}
						className="w-full max-w-[14rem] lg:size-52 lg:max-w-none"
					/>
				)}
			</div>
			{/* Map fills the left column, matching the height of the chart and notes
			    cards stacked beside it. */}
			<div
				className={cn(
					"grid items-stretch gap-4",
					track.length > 1 ? "lg:grid-cols-2" : "lg:w-1/2",
				)}
			>
				{track.length > 1 && <RouteMap track={track} marker={hoverMarker} />}
				<div className="flex min-w-0 flex-col gap-4">
					{hasChart &&
						(useSamples ? (
							<SampleChart
								points={sample.points}
								hasHr={sample.hasHr}
								hasElevation={sample.hasElevation}
								onHover={setHoverIdx}
							/>
						) : (
							<StreamChart
								hr={streamHr}
								elevation={streamElevation}
								onHover={setHoverT}
							/>
						))}
					<Card className="gap-4 py-4">
						<CardHeader className="px-6">
							<CardTitle className="text-sm">Notes & annotations</CardTitle>
						</CardHeader>
						<CardContent className="px-6">
							{(() => {
								const shoeSport =
									category === "running" ||
									category === "hiking" ||
									category === "skiing";
								const shoeRequired =
									shoeSport &&
									(activity.start_time?.slice(0, 10) ?? "") >= SHOE_CUTOFF;
								const shoe = shoeSport ? (
									<ShoeField
										activity={activity}
										onSave={save}
										required={shoeRequired}
									/>
								) : null;

								if (category === "running") {
									return (
										<div className="space-y-3">
											<RunningAnnotation
												activity={activity}
												foodOptions={foodOptions}
												onSave={save}
											/>
											{shoe}
										</div>
									);
								}
								if (category === "climbing") {
									return (
										<ClimbingAnnotation activity={activity} onSave={save} />
									);
								}
								if (category === "strength") {
									return (
										<StrengthAnnotation activity={activity} onSave={save} />
									);
								}
								if (shoe) return shoe;
								return (
									<p className="text-muted-foreground text-sm">
										No annotations for this activity type yet.
									</p>
								);
							})()}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
