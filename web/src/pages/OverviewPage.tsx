import { useQuery } from "@tanstack/react-query";
import {
	Badge,
	Card,
	Center,
	Grid,
	Group,
	Loader,
	ScrollArea,
	Stack,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { fmtDate, fmtDistance } from "../format";
import { categoryColor, categoryOf, needsAnnotation } from "../activityTypes";
import GrafanaLoadPanel from "../components/GrafanaLoadPanel";
import LatestRunRoutesMap from "../components/LatestRunRoutesMap";
import SleepRingPanel from "../components/SleepRingPanel";
import WellbeingPanel from "../components/WellbeingPanel";
import { chartColors, kanagawa } from "../theme";

export default function OverviewPage() {
	const navigate = useNavigate();
	const { data, isLoading } = useQuery({
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

	// Derived completeness — activities still missing required annotations.
	const activities = (data ?? []).filter(needsAnnotation);

	return (
		<>
			<Title order={3} mb="md">
				Overview
			</Title>
			<Grid>
				{activities.length > 0 && (
					<Grid.Col span={{ base: 12, md: 4 }}>
						<Card withBorder h={420}>
							<Group justify="space-between" mb="sm">
								<Text fw={600}>Needs annotation</Text>
								<Badge variant="light">{activities.length}</Badge>
							</Group>
							<ScrollArea h={340}>
								<Stack gap={4}>
									{activities.map((a) => (
										<UnstyledButton
											key={a.id}
											onClick={() => navigate(`/activities/${a.id}`)}
											p="xs"
											style={{ borderRadius: "var(--mantine-radius-sm)" }}
											className="hoverable-row"
										>
											<Group justify="space-between" wrap="nowrap">
												<div style={{ minWidth: 0 }}>
													<Text size="sm" fw={500} truncate>
														{a.name ?? "Activity"}
													</Text>
													<Text size="xs" c="dimmed">
														{fmtDate(a.start_time)}
													</Text>
												</div>
												<Group gap="xs" wrap="nowrap">
													{a.activity_type && (
														<Badge size="sm" variant="light">
															{a.activity_type}
														</Badge>
													)}
													<Text size="xs" c="dimmed">
														{fmtDistance(a.distance_m)}
													</Text>
												</Group>
											</Group>
										</UnstyledButton>
									))}
								</Stack>
							</ScrollArea>
						</Card>
					</Grid.Col>
				)}

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
								kind: "line",
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

				<Grid.Col span={{ base: 12, md: 4 }}>
					<WellbeingPanel />
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 4 }}>
					<SleepRingPanel />
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 4 }}>
					<LatestRunRoutesMap routes={latestRunRoutes ?? []} />
				</Grid.Col>
			</Grid>
		</>
	);
}
