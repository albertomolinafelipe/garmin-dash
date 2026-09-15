import { useQuery } from "@tanstack/react-query";

import { graphQLClient } from "@/graphql/client";

// Approximate weekly time in HR zone 2 (120-139 bpm) for running, counting
// samples in the band. At the ~1 Hz that current devices record, one sample is
// one second; older smart-recorded activities undercount slightly. This is a
// count aggregate, so no sample rows cross the wire -- just one number per week.
const Z2_LOWER = 120;
const Z2_UPPER = 139;

export interface WeekRuns {
	key: string; // week identifier used by the caller for lookup
	ids: number[]; // running activity ids in that week
}

// Returns a map of week key -> approximate zone-2 seconds. Weeks with no running
// activities are omitted (and cost nothing in the query).
export function useWeekZ2(weeks: WeekRuns[]): Map<string, number> {
	const withRuns = weeks.filter((w) => w.ids.length > 0);
	// Stable key: refetches only when the set of weeks or their runs changes.
	const signature = withRuns
		.map((w) => `${w.key}:${[...w.ids].sort((a, b) => a - b).join(",")}`)
		.join("|");

	const { data } = useQuery({
		queryKey: ["week-z2", signature],
		enabled: withRuns.length > 0,
		queryFn: async () => {
			const fields = withRuns
				.map(
					(w, i) =>
						`w${i}: activity_samples_aggregate(where: {activity_id: {_in: [${w.ids.join(",")}]}, hr: {_gte: ${Z2_LOWER}, _lte: ${Z2_UPPER}}}) { aggregate { count } }`,
				)
				.join("\n");
			const result = await graphQLClient.request<
				Record<string, { aggregate: { count: number } | null }>
			>(`query WeekZ2 {\n${fields}\n}`);
			const out: Record<string, number> = {};
			withRuns.forEach((w, i) => {
				out[w.key] = result[`w${i}`]?.aggregate?.count ?? 0;
			});
			return out;
		},
	});

	return new Map(Object.entries(data ?? {}));
}
