import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActionIcon, Card, Center, Group, Loader, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	ResponsiveContainer,
	Scatter,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { api } from "../api/client";
import type { Sleep } from "../api/types";
import { fmtDuration } from "../format";
import { chartColors, kanagawa } from "../theme";

const SCORE = kanagawa.autumnYellow;

// Stages stacked bottom → top as filled bands; each band's raw duration is what the
// tooltip shows, while its top edge sits at the running total (recharts stacking).
const STAGES = [
	{ key: "awakeS", name: "Awake", color: chartColors.awake },
	{ key: "lightS", name: "Light", color: chartColors.light },
	{ key: "remS", name: "REM", color: chartColors.rem },
	{ key: "deepS", name: "Deep", color: chartColors.deep },
] as const;

interface Row {
	date: string;
	fullDate: string;
	awakeS: number;
	lightS: number;
	remS: number;
	deepS: number;
	totalS: number;
	score: number | null;
}

const toRow = (s: Sleep): Row => {
	const awakeS = s.awake_s ?? 0;
	const lightS = s.light_sleep_s ?? 0;
	const remS = s.rem_sleep_s ?? 0;
	const deepS = s.deep_sleep_s ?? 0;
	return {
		date: s.calendar_date.slice(5),
		fullDate: s.calendar_date,
		awakeS,
		lightS,
		remS,
		deepS,
		totalS: awakeS + lightS + remS + deepS,
		score: s.sleep_score ?? null,
	};
};

function StageTooltip({ active, payload }: any) {
	if (!active || !payload?.length) return null;
	const r = payload[0].payload as Row;
	const lines = [
		{ name: "Deep", s: r.deepS, color: chartColors.deep },
		{ name: "REM", s: r.remS, color: chartColors.rem },
		{ name: "Light", s: r.lightS, color: chartColors.light },
		{ name: "Awake", s: r.awakeS, color: chartColors.awake },
	];
	return (
		<div
			style={{
				background: kanagawa.sumiInk2,
				border: `1px solid ${kanagawa.sumiInk4}`,
				borderRadius: 8,
				color: kanagawa.fujiWhite,
				fontSize: 12,
				padding: "8px 10px",
			}}
		>
			<div style={{ marginBottom: 4, fontWeight: 600 }}>{r.fullDate}</div>
			{lines.map((l) => (
				<div
					key={l.name}
					style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
				>
					<span>
						<span style={{ color: l.color }}>●</span> {l.name}
					</span>
					<span>{fmtDuration(l.s)}</span>
				</div>
			))}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					gap: 16,
					marginTop: 4,
					borderTop: `1px solid ${kanagawa.sumiInk4}`,
					paddingTop: 4,
				}}
			>
				<span>Total</span>
				<span>{fmtDuration(r.totalS)}</span>
			</div>
			{r.score != null && (
				<div
					style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
				>
					<span style={{ color: SCORE }}>Score</span>
					<span>{r.score}</span>
				</div>
			)}
		</div>
	);
}

export default function SleepStagesPanel({
	days = 30,
	title = "Sleep",
}: {
	days?: number;
	title?: string;
}) {
	// Pull a deep pool once, then page through it locally in `days`-wide windows.
	const { data, isError, isLoading } = useQuery({
		queryKey: ["sleep", "stages-pool"],
		queryFn: () => api.listSleep({ limit: 400 }),
	});

	// page 0 = most recent window; each step moves STEP days into the past (a sliding
	// window, so consecutive views overlap and are easy to follow).
	const STEP = 7;
	const [page, setPage] = useState(0);
	// Animate the initial load, but not once the user starts scrolling windows.
	const [animate, setAnimate] = useState(true);
	const step = (delta: number) => {
		setAnimate(false);
		setPage((p) => Math.max(0, p + delta));
	};

	// API returns newest-first; reverse to chronological for the trend.
	const allRows: Row[] = [...(data ?? [])].reverse().map(toRow);
	const end = Math.max(0, allRows.length - page * STEP);
	const start = Math.max(0, end - days);
	const rows = allRows.slice(start, end);
	const canGoBack = start > 0;
	const canGoForward = page > 0;
	const rangeLabel =
		rows.length > 0
			? `${rows[0].fullDate} → ${rows[rows.length - 1].fullDate}`
			: "";
	const bodyH = 340;

	return (
		<Card withBorder h={420}>
			<Group justify="space-between" mb="sm">
				<Group gap="xs">
					<Text fw={600}>{title}</Text>
					<ActionIcon
						variant="subtle"
						size="sm"
						aria-label="Earlier nights"
						disabled={!canGoBack}
						onClick={() => step(1)}
					>
						<IconChevronLeft size={16} />
					</ActionIcon>
					<ActionIcon
						variant="subtle"
						size="sm"
						aria-label="Later nights"
						disabled={!canGoForward}
						onClick={() => step(-1)}
					>
						<IconChevronRight size={16} />
					</ActionIcon>
					{rangeLabel && (
						<Text size="xs" c="dimmed">
							{rangeLabel}
						</Text>
					)}
				</Group>
				<Group gap="md">
					{[...STAGES].reverse().map((st) => (
						<Group key={st.name} gap={5} wrap="nowrap">
							<span style={{ color: st.color }}>●</span>
							<Text size="xs" c="dimmed">
								{st.name}
							</Text>
						</Group>
					))}
					<Group gap={5} wrap="nowrap">
						<span style={{ color: SCORE }}>●</span>
						<Text size="xs" c="dimmed">
							Score
						</Text>
					</Group>
				</Group>
			</Group>

			{isLoading ? (
				<Center h={bodyH}>
					<Loader />
				</Center>
			) : isError ? (
				<Center h={bodyH}>
					<Text c="red">Could not load sleep data.</Text>
				</Center>
			) : rows.length === 0 ? (
				<Center h={bodyH}>
					<Text c="dimmed" ta="center">
						No sleep data yet — hit <b>Sync</b> to pull from Garmin.
					</Text>
				</Center>
			) : (
				<ResponsiveContainer width="100%" height={bodyH}>
					<ComposedChart
						data={rows}
						margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
					>
						<defs>
							{STAGES.map((st) => (
								<linearGradient
									key={st.key}
									id={`sleep-fill-${st.key}`}
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop offset="0%" stopColor={st.color} stopOpacity={0.4} />
									<stop offset="100%" stopColor={st.color} stopOpacity={0.04} />
								</linearGradient>
							))}
						</defs>
						<CartesianGrid
							stroke={kanagawa.sumiInk3}
							strokeDasharray="3 3"
							vertical={false}
						/>
						<XAxis
							dataKey="date"
							interval="preserveStartEnd"
							minTickGap={24}
							tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
							stroke={kanagawa.sumiInk4}
						/>
						<YAxis yAxisId="hours" hide />
						<YAxis
							yAxisId="score"
							domain={[0, 100]}
							tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
							stroke={kanagawa.sumiInk4}
							width={32}
						/>
						<Tooltip content={<StageTooltip />} />
						{STAGES.map((st) => (
							<Area
								key={st.key}
								yAxisId="hours"
								type="monotone"
								dataKey={st.key}
								name={st.name}
								stackId="sleep"
								stroke={st.color}
								strokeWidth={2}
								fill={`url(#sleep-fill-${st.key})`}
								isAnimationActive={animate}
								connectNulls
								activeDot={{ r: 3 }}
							/>
						))}
						<Scatter
							yAxisId="score"
							dataKey="score"
							name="Score"
							fill={SCORE}
							shape="circle"
							isAnimationActive={animate}
						/>
					</ComposedChart>
				</ResponsiveContainer>
			)}
		</Card>
	);
}
