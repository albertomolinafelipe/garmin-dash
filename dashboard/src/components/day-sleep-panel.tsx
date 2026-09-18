import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { graphQLClient } from "@/graphql/client";
import { SLEEP_STAGE_COLORS } from "@/lib/sleep";
import { cn } from "@/lib/utils";

// Total sleep as h:mm (e.g. 7:40) rather than the "7h 40m" used elsewhere.
function hhmm(seconds: number | null): string {
	if (!seconds) return "—";
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}:${String(m).padStart(2, "0")}`;
}

const STAGES = [
	{
		key: "deep",
		label: "Deep",
		field: "deep_sleep_s",
		color: SLEEP_STAGE_COLORS.deep,
	},
	{
		key: "light",
		label: "Light",
		field: "light_sleep_s",
		color: SLEEP_STAGE_COLORS.light,
	},
	{
		key: "rem",
		label: "REM",
		field: "rem_sleep_s",
		color: SLEEP_STAGE_COLORS.rem,
	},
	{
		key: "awake",
		label: "Awake",
		field: "awake_s",
		color: SLEEP_STAGE_COLORS.awake,
	},
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

const num = (v: number | string | null | undefined) =>
	v == null ? 0 : Number(v);

export function DaySleepPanel({
	date,
	className,
}: {
	date: string;
	className?: string;
}) {
	const { data, isPending } = useQuery({
		queryKey: ["day-sleep", date],
		queryFn: () => graphQLClient.request<{ sleep: Night[] }>(QUERY, { date }),
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
	const score =
		night?.sleep_score == null ? null : Math.round(num(night.sleep_score));
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
								<Pie
									data={rows}
									dataKey="seconds"
									nameKey="label"
									innerRadius="62%"
									outerRadius="90%"
									paddingAngle={8}
									isAnimationActive={false}
								>
									{/* Coloured border with a faded fill, matching the area plots. */}
									{rows.map((r) => (
										<Cell
											key={r.stage}
											fill={r.color}
											fillOpacity={0.25}
											stroke={r.color}
											strokeWidth={1.5}
										/>
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
							<span className="text-muted-foreground mt-1 text-sm font-medium tabular-nums">
								{hhmm(total)}
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
