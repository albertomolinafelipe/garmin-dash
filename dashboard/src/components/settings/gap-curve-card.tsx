import { useMemo } from "react";
import {
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { stravaFactor, useGapCurve } from "@/lib/gap";
import { num } from "@/lib/queries";

const COLORS = { you: "#7E9CD8", strava: "#FFA066" } as const;

const config = {
	you: { label: "You", color: COLORS.you },
	strava: { label: "Strava", color: COLORS.strava },
} satisfies ChartConfig;

function fmtGrade(grade: number): string {
	return `${grade > 0 ? "+" : ""}${grade}%`;
}

// Pace multiplier per grade at equal heart rate: this athlete's own curve,
// measured from all their runs, against Strava's population model. It changes
// slowly, so it lives with the other personal settings rather than the daily
// overview.
export function GapCurveCard() {
	const { data, isPending, isError } = useGapCurve();
	const rows = useMemo(
		() =>
			(data?.gap_curve ?? []).map((point) => ({
				grade: point.grade_pct,
				you: num(point.factor),
				strava: stravaFactor(point.grade_pct),
				windows: point.windows,
				activities: point.activities,
			})),
		[data],
	);

	let empty: string | null = null;
	if (isPending) empty = "Loading…";
	else if (isError) empty = "Couldn't load the grade curve.";
	else if (rows.length === 0) empty = "No grade curve yet; run a sync.";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Grade adjustment</CardTitle>
				<CardAction>
					<div className="text-muted-foreground flex items-center gap-3 text-xs">
						{(["you", "strava"] as const).map((key) => (
							<span key={key} className="flex items-center gap-1">
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: COLORS[key] }}
								/>
								{config[key].label}
							</span>
						))}
					</div>
				</CardAction>
			</CardHeader>
			<CardContent className="h-[260px]">
				{empty ? (
					<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
						{empty}
					</div>
				) : (
					<ChartContainer config={config} className="aspect-auto h-full w-full">
						<ComposedChart data={rows} margin={{ top: 6, right: 8, left: 0 }}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis
								dataKey="grade"
								type="number"
								domain={["dataMin", "dataMax"]}
								ticks={rows.map((row) => row.grade).filter((g) => g % 10 === 0)}
								tickFormatter={fmtGrade}
								tickLine={false}
								axisLine={false}
								tickMargin={6}
							/>
							<YAxis
								width={40}
								tickLine={false}
								axisLine={false}
								tickFormatter={(value) => `${Number(value).toFixed(1)}×`}
							/>
							{/* On the 1× line a slope costs the same as level ground. */}
							<ReferenceLine y={1} stroke="currentColor" strokeOpacity={0.3} />
							<ReferenceLine x={0} stroke="currentColor" strokeOpacity={0.3} />
							<ChartTooltip
								content={
									<ChartTooltipContent
										labelFormatter={(_, payload) => {
											const row = payload?.[0]?.payload;
											if (!row) return null;
											return `${fmtGrade(row.grade)} · ${row.windows} min from ${row.activities} runs`;
										}}
										formatter={(value, name) => {
											const key = name as keyof typeof config;
											return (
												<div className="flex w-full items-center justify-between gap-4">
													<span className="flex items-center gap-1.5">
														<span
															className="size-2 rounded-full"
															style={{ backgroundColor: config[key]?.color }}
														/>
														<span className="text-muted-foreground">
															{config[key]?.label ?? String(name)}
														</span>
													</span>
													<span className="text-foreground font-mono font-medium tabular-nums">
														{Number(value).toFixed(2)}×
													</span>
												</div>
											);
										}}
									/>
								}
							/>
							<Line
								type="monotone"
								dataKey="strava"
								stroke={COLORS.strava}
								strokeWidth={2}
								strokeDasharray="4 3"
								dot={false}
							/>
							<Line
								type="monotone"
								dataKey="you"
								stroke={COLORS.you}
								strokeWidth={2}
								dot={{ r: 2 }}
							/>
						</ComposedChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
