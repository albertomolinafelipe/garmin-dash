import { num, type ReadinessDay } from "@/lib/queries";

// The six inputs Garmin blends into the readiness score. Each carries a 0-100
// sub-score (`percentField`) and a qualitative tier (`feedbackField`).
export interface FactorDef {
	key: string;
	label: string;
	percentField: keyof ReadinessDay;
	feedbackField: keyof ReadinessDay;
}

export const READINESS_FACTORS: FactorDef[] = [
	{
		key: "sleep_score",
		label: "Sleep",
		percentField: "sleep_score_factor_percent",
		feedbackField: "sleep_score_factor_feedback",
	},
	{
		key: "recovery",
		label: "Recovery",
		percentField: "recovery_time_factor_percent",
		feedbackField: "recovery_time_factor_feedback",
	},
	{
		key: "acwr",
		label: "Load balance",
		percentField: "acwr_factor_percent",
		feedbackField: "acwr_factor_feedback",
	},
	{
		key: "stress",
		label: "Stress history",
		percentField: "stress_history_factor_percent",
		feedbackField: "stress_history_factor_feedback",
	},
	{
		key: "hrv",
		label: "HRV",
		percentField: "hrv_factor_percent",
		feedbackField: "hrv_factor_feedback",
	},
	{
		key: "sleep_history",
		label: "Sleep history",
		percentField: "sleep_history_factor_percent",
		feedbackField: "sleep_history_factor_feedback",
	},
];

// Qualitative tiers, worst → best, shared by factor feedback and readiness level.
export const TIER_COLOR: Record<string, string> = {
	POOR: "#C34043",
	LOW: "#FF9E3B",
	MODERATE: "#DCA561",
	GOOD: "#7AA89F",
	VERY_GOOD: "#76946A",
	HIGH: "#76946A",
	PRIME: "#98BB6C",
	NONE: "#6B7280",
};

const TIER_RANK: Record<string, number> = {
	POOR: 0,
	LOW: 1,
	MODERATE: 2,
	GOOD: 3,
	VERY_GOOD: 4,
	HIGH: 4,
	PRIME: 5,
	NONE: 9,
};

export function tierColor(tier: string | null | undefined): string {
	return TIER_COLOR[tier ?? "NONE"] ?? TIER_COLOR.NONE;
}

// Sort key so the weakest, score-limiting factor floats to the top of a list.
export function tierRank(tier: string | null | undefined): number {
	return TIER_RANK[tier ?? "NONE"] ?? TIER_RANK.NONE;
}

// Garmin enums (FOO_BAR_BAZ) read as plain sentences: "Foo bar baz". UNKNOWN /
// NONE carry no signal, so collapse them to empty.
export function humanize(s: string | null | undefined): string {
	if (!s || s === "UNKNOWN" || s === "NONE") return "";
	return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
}

// recovery_time is minutes until fully recovered.
export function fmtRecovery(min: number | null | undefined): string {
	if (min == null || min <= 0) return "Fully recovered";
	const hours = Math.round(min / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	const rem = hours % 24;
	return rem ? `${days}d ${rem}h` : `${days}d`;
}

// Score bands mirror Garmin's readiness levels for the hero colour.
export function scoreColor(score: number | null | undefined): string {
	if (score == null) return TIER_COLOR.NONE;
	if (score >= 75) return TIER_COLOR.VERY_GOOD;
	if (score >= 50) return TIER_COLOR.MODERATE;
	if (score >= 25) return TIER_COLOR.LOW;
	return TIER_COLOR.POOR;
}

// Keep one row per calendar day (the query already orders newest-timestamp
// first), oldest → newest for charting.
export function dailyReadiness(rows: ReadinessDay[] | undefined): ReadinessDay[] {
	const seen = new Set<string>();
	const out: ReadinessDay[] = [];
	for (const r of rows ?? []) {
		if (seen.has(r.calendar_date)) continue;
		seen.add(r.calendar_date);
		out.push(r);
	}
	return out.reverse();
}

// Chronic load ≈ trailing 28-day mean of Garmin's (already ~7-day weighted)
// acute load; their ratio is a workload-balance proxy in the spirit of ACWR.
export const ACWR_WINDOW = 28;
export const ACWR_SWEET_LOW = 0.8;
export const ACWR_SWEET_HIGH = 1.3;

export interface LoadPoint {
	date: string;
	acute: number | null;
	chronic: number | null;
	ratio: number | null;
}

export function loadSeries(daily: ReadinessDay[]): LoadPoint[] {
	const acute = daily.map((r) =>
		r.acute_load == null ? null : num(r.acute_load),
	);
	return daily.map((r, i) => {
		const window = acute
			.slice(Math.max(0, i - ACWR_WINDOW + 1), i + 1)
			.filter((v): v is number => v != null);
		const chronic = window.length ? window.reduce((a, b) => a + b, 0) / window.length : null;
		const a = acute[i];
		const ratio = a != null && chronic ? a / chronic : null;
		return {
			date: r.calendar_date.slice(5),
			acute: a,
			chronic: chronic == null ? null : +chronic.toFixed(0),
			ratio: ratio == null ? null : +ratio.toFixed(2),
		};
	});
}

// Pearson correlation over paired samples; null when too sparse or degenerate.
export function pearson(pairs: [number, number][]): number | null {
	const n = pairs.length;
	if (n < 5) return null;
	let sx = 0,
		sy = 0,
		sxx = 0,
		syy = 0,
		sxy = 0;
	for (const [x, y] of pairs) {
		sx += x;
		sy += y;
		sxx += x * x;
		syy += y * y;
		sxy += x * y;
	}
	const cov = n * sxy - sx * sy;
	const dx = Math.sqrt(n * sxx - sx * sx);
	const dy = Math.sqrt(n * syy - sy * sy);
	if (dx === 0 || dy === 0) return null;
	return cov / (dx * dy);
}

export function strengthLabel(r: number): string {
	const a = Math.abs(r);
	if (a >= 0.6) return "strong";
	if (a >= 0.4) return "moderate";
	if (a >= 0.2) return "weak";
	return "negligible";
}

export interface Driver {
	key: string;
	label: string;
	r: number;
	strength: string;
}

// How strongly the daily readiness score tracks each of its inputs (plus raw
// acute load) across the fetched history — i.e. which signals move your score.
export function readinessDrivers(daily: ReadinessDay[]): Driver[] {
	const targets: { key: string; label: string; field: keyof ReadinessDay }[] = [
		...READINESS_FACTORS.map((f) => ({
			key: f.key,
			label: f.label,
			field: f.percentField,
		})),
		{ key: "acute_load", label: "Acute load", field: "acute_load" as const },
	];
	const drivers: Driver[] = [];
	for (const t of targets) {
		const pairs: [number, number][] = [];
		for (const r of daily) {
			if (r.score == null || r[t.field] == null) continue;
			pairs.push([num(r.score), num(r[t.field] as number | string)]);
		}
		const r = pearson(pairs);
		if (r == null) continue;
		drivers.push({ key: t.key, label: t.label, r, strength: strengthLabel(r) });
	}
	return drivers.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}
