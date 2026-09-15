import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	XAxis,
	YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { addDays, startOfWeek } from "@/components/calendar/model";
import { graphQLClient } from "@/graphql/client";
import { categoryOf } from "@/lib/activity-types";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

// One red (the theme's autumnRed), fading in intensity toward Z5 so the hardest
// zone reads strongest and the easy zones recede.
const RED = "#C34043";
const ZONES = [
	{ zone: 1, label: "Z1", min: 0, max: 119, opacity: 0.2 },
	{ zone: 2, label: "Z2", min: 120, max: 139, opacity: 0.4 },
	{ zone: 3, label: "Z3", min: 140, max: 159, opacity: 0.6 },
	{ zone: 4, label: "Z4", min: 160, max: 169, opacity: 0.8 },
	{ zone: 5, label: "Z5", min: 170, max: Infinity, opacity: 1 },
] as const;

// A sample represents the seconds until the next one, so a gap longer than this
// means the watch was paused rather than the effort continuing.
const MAX_GAP_S = 60;

// Full-resolution samples: one row per FIT record, `elapsed_s` measured from the
// activity's start. Rows are grouped by activity and ordered within it, so a
// zone gets the time between each sample and the next one in the same activity.
// The activities list rides along so we can keep only running samples.
const QUERY = `
  query WeekHrRunning($start: timestamptz!, $end: timestamptz!) {
    activities(where: { start_time: { _gte: $start, _lt: $end } }) {
      id
      activity_type
      subtype
    }
    activity_samples(
      where: { recorded_at: { _gte: $start, _lt: $end }, hr: { _is_null: false } }
      order_by: [{ activity_id: asc }, { elapsed_s: asc }]
    ) {
      activity_id
      elapsed_s
      hr
    }
  }
`;

interface Sample {
	// bigint arrives as a number for these small ids; String()-coerce before any
	// comparison so it matches the activity id set regardless of representation.
	activity_id: string | number;
	elapsed_s: number;
	hr: number | null;
}

interface SamplesRow {
	activities: {
		id: string | number;
		activity_type: string | null;
		subtype: string | null;
	}[];
	activity_samples: Sample[];
}

function zoneOf(bpm: number): number {
	for (const z of ZONES) if (bpm <= z.max) return z.zone;
	return 5;
}

function accumulate(data: SamplesRow | undefined) {
	const seconds = new Map<number, number>(ZONES.map((z) => [z.zone, 0]));
	let skipped = 0;
	// This chart is running only, so ignore samples from any other sport.
	const running = new Set(
		(data?.activities ?? [])
			.filter((a) => categoryOf(a.activity_type, a.subtype) === "running")
			.map((a) => String(a.id)),
	);
	const samples = data?.activity_samples ?? [];
	for (let i = 0; i < samples.length - 1; i++) {
		const cur = samples[i];
		const next = samples[i + 1];
		const curId = String(cur.activity_id);
		if (!running.has(curId)) continue;
		// The next row closes this interval only if it is the same activity.
		if (String(next.activity_id) !== curId) continue;
		const dt = next.elapsed_s - cur.elapsed_s;
		const bpm = cur.hr;
		if (dt <= 0) continue;
		if (dt > MAX_GAP_S || !bpm || bpm <= 0) {
			skipped += Math.min(Math.max(dt, 0), MAX_GAP_S);
			continue;
		}
		seconds.set(zoneOf(bpm), (seconds.get(zoneOf(bpm)) ?? 0) + dt);
	}
	return { seconds, skipped };
}

const chartConfig = {
	seconds: { label: "Time" },
} satisfies ChartConfig;

function Message({ children }: { children: ReactNode }) {
	return (
		<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
			{children}
		</div>
	);
}

export function WeeklyHrZones({ className }: { className?: string }) {
	const [offsetWeeks, setOffsetWeeks] = useState(0);
	const { start, end } = useMemo(() => {
		const s = addDays(startOfWeek(new Date()), offsetWeeks * 7);
		return { start: s, end: addDays(s, 7) };
	}, [offsetWeeks]);

	const { data, isPending, error } = useQuery({
		queryKey: ["week-hr-zones", start.toISOString()],
		queryFn: () =>
			graphQLClient.request<SamplesRow>(QUERY, {
				start: start.toISOString(),
				end: end.toISOString(),
			}),
	});

	const { rows, total } = useMemo(() => {
		const { seconds } = accumulate(data);
		const sum = [...seconds.values()].reduce((a, b) => a + b, 0);
		return {
			total: sum,
			rows: ZONES.map((z) => {
				const s = seconds.get(z.zone) ?? 0;
				return {
					zone: z.label,
					range: z.max === Infinity ? `${z.min}+ bpm` : `${z.min}–${z.max} bpm`,
					opacity: z.opacity,
					seconds: s,
					text: s > 0 ? fmtDuration(s) : "",
				};
			}),
		};
	}, [data]);

	const weekLabel =
		offsetWeeks === 0
			? "This week"
			: `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${addDays(end, -1).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

	return (
		<Card className={cn("min-h-0 gap-2 py-3", className)}>
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					Heart-rate zones
					<span className="text-muted-foreground ml-2 font-normal">{weekLabel}</span>
				</CardTitle>
				<CardAction>
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground text-sm tabular-nums">
							{total > 0 ? fmtDuration(total) : ""}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-6"
								onClick={() => setOffsetWeeks((w) => w - 1)}
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-6"
								disabled={offsetWeeks >= 0}
								onClick={() => setOffsetWeeks((w) => Math.min(0, w + 1))}
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>
				</CardAction>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 px-4 pb-1">
				<ZoneChart isPending={isPending} error={error} total={total} rows={rows} />
			</CardContent>
		</Card>
	);
}

// X-axis label under each column: the zone name with its bpm range dimmed below.
function ZoneTick({
	x = 0,
	y = 0,
	payload,
}: {
	x?: number;
	y?: number;
	payload?: { value?: string };
}) {
	const zone = ZONES.find((z) => z.label === payload?.value);
	const range = !zone
		? ""
		: zone.max === Infinity
			? `${zone.min}+`
			: `${zone.min}–${zone.max}`;
	return (
		<g transform={`translate(${x},${y})`}>
			<text
				y={13}
				textAnchor="middle"
				className="fill-foreground text-sm font-medium"
			>
				{payload?.value}
			</text>
			<text
				y={27}
				textAnchor="middle"
				className="fill-muted-foreground text-xs tabular-nums"
			>
				{range}
			</text>
		</g>
	);
}

function ZoneChart({
	isPending,
	error,
	total,
	rows,
}: {
	isPending: boolean;
	error: Error | null;
	total: number;
	rows: {
		zone: string;
		range: string;
		opacity: number;
		seconds: number;
		text: string;
	}[];
}) {
	if (isPending) return <Message>Loading…</Message>;
	if (error) return <Message>Could not load heart-rate data.</Message>;
	if (total === 0)
		return (
			<Message>
				No running heart-rate data this week — use ‹ for earlier weeks.
			</Message>
		);
	return (
		<ChartContainer config={chartConfig} className="aspect-square h-full w-full">
			<BarChart data={rows} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
				<CartesianGrid vertical={false} strokeDasharray="3 3" />
				<XAxis
					dataKey="zone"
					tickLine={false}
					axisLine={false}
					tickMargin={6}
					interval={0}
					height={44}
					tick={<ZoneTick />}
				/>
				<YAxis type="number" dataKey="seconds" hide />
				<ChartTooltip
					content={
						<ChartTooltipContent
							hideIndicator
							labelFormatter={(label, payload) =>
								`${label} · ${payload?.[0]?.payload.range}`
							}
							formatter={(value) => {
								const s = Number(value);
								const pct = total > 0 ? Math.round((s / total) * 100) : 0;
								return `${fmtDuration(s)} (${pct}%)`;
							}}
						/>
					}
				/>
				<Bar dataKey="seconds" radius={[4, 4, 0, 0]} isAnimationActive={false}>
					{rows.map((r) => (
						<Cell key={r.zone} fill={RED} fillOpacity={r.opacity} />
					))}
					<LabelList
						dataKey="text"
						position="top"
						className="fill-muted-foreground text-xs tabular-nums"
					/>
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
