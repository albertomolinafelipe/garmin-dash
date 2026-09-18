import { useMemo } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	XAxis,
	YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { num, type ReadinessDay, useReadiness } from "@/lib/queries";
import {
	ACWR_SWEET_HIGH,
	ACWR_SWEET_LOW,
	ACWR_WINDOW,
	dailyReadiness,
	fmtRecovery,
	humanize,
	loadSeries,
	READINESS_FACTORS,
	readinessDrivers,
	scoreColor,
	tierColor,
	tierRank,
} from "@/lib/readiness";

const HISTORY = 180;
const POS = "#76946A";
const CAUTION = "#DCA561";
const NEG = "#C34043";

// Rendered at the bottom of the Analysis page: the four readiness panels laid
// out as two rows — Today + Load balance on top, the two bar plots below.
export function ReadinessSection() {
	const { data, isPending } = useReadiness(HISTORY);
	const daily = useMemo(() => dailyReadiness(data?.training_readiness), [data]);
	const today = daily.length ? daily[daily.length - 1] : null;

	return (
		<>
			<div className="flex items-center gap-3 pt-2">
				<span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Training readiness
				</span>
				<div className="bg-border h-px flex-1" />
			</div>
			{isPending ? (
				<Centered>Loading…</Centered>
			) : !today ? (
				<Centered>No training readiness synced yet.</Centered>
			) : (
				<>
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<TodayCard today={today} />
						<LoadBalanceCard today={today} daily={daily} />
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<FactorBreakdown today={today} />
						<DriversCard daily={daily} />
					</div>
				</>
			)}
		</>
	);
}

function TodayCard({ today }: { today: ReadinessDay }) {
	const score = today.score == null ? null : num(today.score);
	const color = scoreColor(score);
	const headline = humanize(today.feedback_short);
	const recovery = fmtRecovery(
		today.recovery_time == null ? null : num(today.recovery_time),
	);
	const recoveryWhy = humanize(today.recovery_time_change_phrase);
	return (
		<Card className="gap-2 py-3">
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					Today · {today.calendar_date}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 px-4">
				<div className="flex items-center gap-4">
					<div
						className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 font-mono text-4xl font-semibold tabular-nums"
						style={{ borderColor: color, color }}
					>
						{score ?? "—"}
					</div>
					<div className="min-w-0">
						<span
							className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium"
							style={{ backgroundColor: `${color}22`, color }}
						>
							{humanize(today.level) || "Unknown"}
						</span>
						{headline && (
							<p className="text-foreground mt-2 text-lg leading-tight font-medium">
								{headline}
							</p>
						)}
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<Stat label="Recovery">
						{recovery}
						{recoveryWhy && (
							<span className="text-muted-foreground ml-1 text-xs">
								· {recoveryWhy.toLowerCase()}
							</span>
						)}
					</Stat>
					<Stat label="Acute load">
						{today.acute_load == null ? "—" : num(today.acute_load)}
					</Stat>
				</div>
			</CardContent>
		</Card>
	);
}

function FactorBreakdown({ today }: { today: ReadinessDay }) {
	const factors = READINESS_FACTORS.map((f) => {
		const pct = today[f.percentField];
		const tier = today[f.feedbackField] as string | null;
		return {
			key: f.key,
			label: f.label,
			pct: pct == null ? null : num(pct),
			tier,
		};
	}).sort((a, b) => {
		const rank = tierRank(a.tier) - tierRank(b.tier);
		return rank !== 0 ? rank : (a.pct ?? 0) - (b.pct ?? 0);
	});
	const limiter = factors.find((f) => f.pct != null);
	return (
		<Card className="gap-2 py-3">
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					What's driving today's score
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4">
				{limiter && (
					<p className="text-muted-foreground mb-3 text-xs">
						Weakest factor:{" "}
						<span style={{ color: tierColor(limiter.tier) }}>
							{limiter.label}
						</span>{" "}
						({humanize(limiter.tier).toLowerCase() || "no data"})
					</p>
				)}
				<div className="flex flex-col gap-2.5">
					{factors.map((f) => (
						<div key={f.key} className="flex items-center gap-3 text-sm">
							<span className="w-24 shrink-0 truncate">{f.label}</span>
							<div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
								<div
									className="h-full rounded-full transition-all"
									style={{
										width: `${f.pct ?? 0}%`,
										backgroundColor: tierColor(f.tier),
									}}
								/>
							</div>
							<span className="text-muted-foreground w-28 shrink-0 text-right text-xs">
								<span className="text-foreground font-mono tabular-nums">
									{f.pct ?? "—"}
								</span>{" "}
								{humanize(f.tier).toLowerCase()}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function LoadBalanceCard({
	today,
	daily,
}: {
	today: ReadinessDay;
	daily: ReadinessDay[];
}) {
	const points = useMemo(() => loadSeries(daily), [daily]);
	const recent = points.slice(-90);
	const ratio = points.length ? points[points.length - 1].ratio : null;
	const acwrFeedback = humanize(today.acwr_factor_feedback);
	return (
		<Card className="gap-2 py-3">
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					Load balance · acute vs {ACWR_WINDOW}-day average
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4 px-4 lg:flex-row">
				<div className="h-[240px] min-w-0 flex-1">
					<ChartContainer config={LOAD_CONFIG} className="h-full w-full">
						<ComposedChart data={recent} margin={{ top: 6, right: 4, left: 0 }}>
							<defs>
								<linearGradient
									id="fill-acute-load"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor={LOAD_COLORS.acute}
										stopOpacity={0.35}
									/>
									<stop
										offset="100%"
										stopColor={LOAD_COLORS.acute}
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="date"
								interval={14}
								tickLine={false}
								axisLine={false}
								tickMargin={6}
							/>
							<YAxis width={34} tickLine={false} axisLine={false} />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area
								type="monotone"
								dataKey="acute"
								name="Acute load"
								stroke={LOAD_COLORS.acute}
								fill="url(#fill-acute-load)"
								strokeWidth={1.75}
								dot={false}
								connectNulls
							/>
							<Line
								type="monotone"
								dataKey="chronic"
								name="Chronic (28d)"
								stroke={LOAD_COLORS.chronic}
								strokeWidth={1.5}
								strokeDasharray="4 3"
								dot={false}
								connectNulls
							/>
						</ComposedChart>
					</ChartContainer>
				</div>
				<div className="lg:w-64 lg:shrink-0">
					<AcwrGauge ratio={ratio} feedback={acwrFeedback} />
				</div>
			</CardContent>
		</Card>
	);
}

function AcwrGauge({
	ratio,
	feedback,
}: {
	ratio: number | null;
	feedback: string;
}) {
	const LO = 0.5;
	const HI = 2.0;
	const pos = (v: number) =>
		((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * 100;
	const inZone =
		ratio != null && ratio >= ACWR_SWEET_LOW && ratio <= ACWR_SWEET_HIGH;
	const status =
		ratio == null
			? "—"
			: ratio < ACWR_SWEET_LOW
				? "Detraining"
				: ratio > ACWR_SWEET_HIGH
					? "Ramping fast"
					: "Balanced";
	return (
		<div className="flex h-full flex-col justify-center gap-2">
			<div className="flex items-baseline gap-2">
				<span
					className="font-mono text-3xl font-semibold tabular-nums"
					style={{ color: inZone ? POS : CAUTION }}
				>
					{ratio == null ? "—" : ratio.toFixed(2)}
				</span>
				<span className="text-muted-foreground text-xs">acute : chronic</span>
			</div>
			<div
				className="relative mt-1 h-3 w-full rounded-full"
				style={{ backgroundColor: `${NEG}40` }}
			>
				<div
					className="absolute top-0 h-full rounded-sm"
					style={{
						left: `${pos(ACWR_SWEET_LOW)}%`,
						width: `${pos(ACWR_SWEET_HIGH) - pos(ACWR_SWEET_LOW)}%`,
						backgroundColor: `${POS}66`,
					}}
				/>
				{ratio != null && (
					<div
						className="border-background absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
						style={{ left: `${pos(ratio)}%` }}
					/>
				)}
			</div>
			<div className="text-muted-foreground flex justify-between text-[10px]">
				<span>detrain</span>
				<span>sweet spot</span>
				<span>injury risk</span>
			</div>
			<p className="mt-1 text-sm">
				<span
					className="font-medium"
					style={{ color: inZone ? POS : CAUTION }}
				>
					{status}
				</span>
				{feedback && (
					<span className="text-muted-foreground">
						{" "}
						· Garmin: {feedback.toLowerCase()}
					</span>
				)}
			</p>
		</div>
	);
}

function DriversCard({ daily }: { daily: ReadinessDay[] }) {
	const drivers = useMemo(() => readinessDrivers(daily), [daily]);
	const max = Math.max(0.001, ...drivers.map((d) => Math.abs(d.r)));
	return (
		<Card className="gap-2 py-3">
			<CardHeader className="px-4">
				<CardTitle className="text-sm font-medium">
					What moves your readiness · last {daily.length} days
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4">
				<p className="text-muted-foreground mb-3 text-xs">
					How strongly your daily score tracks each signal (Pearson r). Longer
					bar = bigger swing factor for you.
				</p>
				<div className="flex flex-col gap-2.5">
					{drivers.map((d) => (
						<div key={d.key} className="flex items-center gap-3 text-sm">
							<span className="w-28 shrink-0 truncate">{d.label}</span>
							<div className="bg-muted relative h-2.5 flex-1 overflow-hidden rounded-full">
								<div
									className="h-full rounded-full"
									style={{
										width: `${(Math.abs(d.r) / max) * 100}%`,
										backgroundColor: d.r >= 0 ? POS : NEG,
									}}
								/>
							</div>
							<span className="text-muted-foreground w-32 shrink-0 text-right text-xs">
								<span className="text-foreground font-mono tabular-nums">
									{d.r >= 0 ? "+" : ""}
									{d.r.toFixed(2)}
								</span>{" "}
								{d.strength}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function Stat({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="bg-muted/40 rounded-md px-3 py-2">
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="text-foreground font-medium">{children}</div>
		</div>
	);
}

function Centered({ children }: { children: React.ReactNode }) {
	return (
		<div className="text-muted-foreground flex h-full items-center justify-center p-8 text-sm">
			{children}
		</div>
	);
}

const LOAD_COLORS = { acute: "#C34043", chronic: "#7E9CD8" };
const LOAD_CONFIG = {
	acute: { label: "Acute load", color: LOAD_COLORS.acute },
	chronic: { label: "Chronic (28d)", color: LOAD_COLORS.chronic },
} satisfies ChartConfig;
