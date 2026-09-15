import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart } from "recharts";

import {
	Card,
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
import { graphQLClient } from "@/graphql/client";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

// Kanagawa sleep-stage tones, matching the overview sleep chart.
const STAGES = [
	{ key: "deep", label: "Deep", field: "deep_sleep_s", color: "#658594" },
	{ key: "light", label: "Light", field: "light_sleep_s", color: "#7E9CD8" },
	{ key: "rem", label: "REM", field: "rem_sleep_s", color: "#957FB8" },
	{ key: "awake", label: "Awake", field: "awake_s", color: "#54546D" },
] as const;

interface Night {
	total_sleep_s: number | string | null;
	deep_sleep_s: number | string | null;
	light_sleep_s: number | string | null;
	rem_sleep_s: number | string | null;
	awake_s: number | string | null;
	sleep_score: number | string | null;
}

const QUERY = `
	query DaySleep($date: date!) {
		sleep(where: { calendar_date: { _eq: $date } }, limit: 1) {
			total_sleep_s
			deep_sleep_s
			light_sleep_s
			rem_sleep_s
			awake_s
			sleep_score
		}
	}
`;

const chartConfig = Object.fromEntries(
	STAGES.map((s) => [s.key, { label: s.label, color: s.color }]),
) satisfies ChartConfig;

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));

export function DaySleepPanel({
	date,
	className,
}: {
	date: string;
	className?: string;
}) {
	const { data, isPending } = useQuery({
		queryKey: ["day-sleep", date],
		queryFn: () =>
			graphQLClient.request<{ sleep: Night[] }>(QUERY, { date }),
	});
	const night = data?.sleep[0];
	const rows = night
		? STAGES.map((s) => ({
				stage: s.key,
				label: s.label,
				color: s.color,
				seconds: num(night[s.field]),
			})).filter((r) => r.seconds > 0)
		: [];
	const score = night?.sleep_score == null ? null : Math.round(num(night.sleep_score));
	const total = num(night?.total_sleep_s);

	return (
		<Card className={cn("aspect-square gap-2 py-3", className)}>
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">Sleep</CardTitle>
			</CardHeader>
			<CardContent className="relative min-h-0 flex-1 px-2 pb-2">
				{isPending || !night || rows.length === 0 ? (
					<div className="text-muted-foreground flex h-full items-center justify-center text-sm">
						{isPending ? "Loading…" : "No sleep for this day."}
					</div>
				) : (
					<>
						<ChartContainer config={chartConfig} className="h-full w-full">
							<PieChart>
								<ChartTooltip
									content={
										<ChartTooltipContent
											hideLabel
											formatter={(value, name) => (
												<span className="flex w-full items-center justify-between gap-3">
													<span className="text-muted-foreground capitalize">
														{String(name)}
													</span>
													<span className="text-foreground font-mono tabular-nums">
														{fmtDuration(Number(value))}
													</span>
												</span>
											)}
										/>
									}
								/>
								<Pie
									data={rows}
									dataKey="seconds"
									nameKey="label"
									innerRadius="62%"
									outerRadius="90%"
									paddingAngle={2}
									strokeWidth={0}
									isAnimationActive={false}
								>
									{rows.map((r) => (
										<Cell key={r.stage} fill={r.color} />
									))}
								</Pie>
							</PieChart>
						</ChartContainer>
						{/* Score and total sleep, centred in the donut hole. */}
						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
							{score != null && (
								<span className="text-2xl font-semibold tabular-nums leading-none">
									{score}
								</span>
							)}
							<span className="text-muted-foreground text-xs">
								{score != null ? "score" : ""}
							</span>
							<span className="mt-1 text-sm font-medium tabular-nums">
								{fmtDuration(total)}
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
