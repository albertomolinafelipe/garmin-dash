import { useQuery } from "@tanstack/react-query";
import { Center, Grid, Loader, Title } from "@mantine/core";

import { api } from "../api/client";
import { categoryColor, categoryOf } from "../activityTypes";
import GrafanaLoadPanel from "../components/GrafanaLoadPanel";
import LatestRunRoutesMap from "../components/LatestRunRoutesMap";
import SleepStagesPanel from "../components/SleepStagesPanel";
import { chartColors, kanagawa } from "../theme";

export default function OverviewPage() {
	const { isLoading } = useQuery({
		queryKey: ["activities", "all"],
		queryFn: () => api.listActivities({ limit: 500 }),
	});
	const { data: latestRunRoutes } = useQuery({
		queryKey: ["activities", "latest-run-routes", 1],
		queryFn: () => api.latestRunRoutes({ limit: 1 }),
	});

	if (isLoading)
		return (
			<Center h={200}>
				<Loader />
			</Center>
		);

	return (
		<>
			<Title order={3} mb="md">
				Overview
			</Title>
			<Grid>
				<Grid.Col span={{ base: 12, md: 8 }}>
					<GrafanaLoadPanel
						title="Running load"
						queryKey="running-load"
						series={[
							{
								key: "km",
								label: "Distance",
								unit: "km",
								color: chartColors.load,
								kind: "area",
								axis: "left",
								valueOf: (a) =>
									a.activity_type?.includes("running") && a.distance_m
										? a.distance_m / 1000
										: null,
							},
							{
								key: "elev",
								label: "Vertical",
								unit: "m",
								color: kanagawa.sakuraPink,
								kind: "area",
								axis: "right",
								valueOf: (a) =>
									a.activity_type?.includes("running") && a.elevation_gain_m
										? a.elevation_gain_m
										: null,
							},
						]}
					/>
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 4 }}>
					<GrafanaLoadPanel
						title="Climbing & weights load"
						queryKey="strength-load"
						series={[
							// Climbing first so weights renders on top of it.
							{
								key: "climbing",
								label: "Climbing",
								unit: "h",
								color: categoryColor.climbing,
								kind: "area",
								valueOf: (a) =>
									categoryOf(a.activity_type, a.subtype) === "climbing" &&
									a.duration_s
										? a.duration_s / 3600
										: null,
							},
							{
								key: "weights",
								label: "Weights",
								unit: "h",
								color: categoryColor.strength,
								kind: "area",
								valueOf: (a) =>
									categoryOf(a.activity_type, a.subtype) === "strength" &&
									a.duration_s
										? a.duration_s / 3600
										: null,
							},
						]}
					/>
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 8 }}>
					<SleepStagesPanel title="Sleep" days={30} />
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 4 }}>
					<LatestRunRoutesMap routes={latestRunRoutes ?? []} />
				</Grid.Col>
			</Grid>
		</>
	);
}
