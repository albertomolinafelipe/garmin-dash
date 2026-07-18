import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ActionIcon,
	Badge,
	Button,
	Card,
	Center,
	Grid,
	Group,
	Loader,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck } from "@tabler/icons-react";
import { useParams } from "react-router-dom";

import { api } from "../api/client";
import { queryClient } from "../queryClient";
import type { Annotation } from "../api/types";
import { fmtDate } from "../format";
import { categoryColor, categoryOf, needsAnnotation } from "../activityTypes";
import ActivityMetrics from "../components/ActivityMetrics";
import ActivityTypeLabel from "../components/ActivityTypeLabel";
import HrElevationChart from "../components/HrElevationChart";
import RouteMap from "../components/RouteMap";
import RunningAnnotation from "../components/RunningAnnotation";
import ClimbingAnnotation from "../components/ClimbingAnnotation";
import StrengthAnnotation from "../components/StrengthAnnotation";

export default function ActivityDetailPage() {
	const { id } = useParams();
	const activityId = Number(id);

	const { data: a, isLoading } = useQuery({
		queryKey: ["activity", activityId],
		queryFn: () => api.getActivity(activityId),
	});
	const { data: foodOptions } = useQuery({
		queryKey: ["food-options"],
		queryFn: () => api.foodOptions(),
	});
	// Per-record streams parsed on demand from the raw .fit (only if we have one).
	const { data: streams, isLoading: streamsLoading } = useQuery({
		queryKey: ["activity", activityId, "streams"],
		queryFn: () => api.activityStreams(activityId),
		enabled: !!a?.fit_path,
	});

	const save = useMutation({
		mutationFn: (body: Annotation) => api.updateActivity(activityId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
			queryClient.invalidateQueries({ queryKey: ["activities"] });
			queryClient.invalidateQueries({ queryKey: ["food-options"] });
		},
		onError: (e: unknown) =>
			notifications.show({
				title: "Save failed",
				message: String(e),
				color: "red",
			}),
	});

	// Local override: mark a strength session as climbing (persists once a type is set).
	const [asClimbing, setAsClimbing] = useState(false);

	// Editable name — local buffer, saved only on explicit confirm.
	const [name, setName] = useState("");
	useEffect(() => {
		if (a) setName(a.name ?? "");
	}, [a?.name]);

	if (isLoading || !a)
		return (
			<Center h={200}>
				<Loader />
			</Center>
		);

	const category = categoryOf(a.activity_type, a.subtype);
	const color = categoryColor[category];
	const nameDirty = name !== (a.name ?? "");
	const confirmName = () => nameDirty && save.mutate({ name });

	return (
		<Stack>
			{/* Title (1/3) + metrics (2/3) on one row */}
			<Grid align="stretch">
				<Grid.Col span={{ base: 12, md: 4 }}>
					<Card
						withBorder
						h="100%"
						style={{ borderLeft: `4px solid ${color}` }}
					>
						<Group gap="xs" wrap="nowrap">
							<TextInput
								variant="unstyled"
								style={{ flex: 1 }}
								value={name}
								onChange={(e) => setName(e.currentTarget.value)}
								onKeyDown={(e) => e.key === "Enter" && confirmName()}
								placeholder="Activity name"
								styles={{
									input: {
										fontSize: "var(--mantine-font-size-xl)",
										fontWeight: 700,
									},
								}}
							/>
							{nameDirty && (
								<ActionIcon
									variant="light"
									color="green"
									size="lg"
									aria-label="Confirm name"
									onClick={confirmName}
								>
									<IconCheck size={18} />
								</ActionIcon>
							)}
						</Group>
						<Group gap="sm" mt={4}>
							<Text c="dimmed">{fmtDate(a.start_time)}</Text>
							<ActivityTypeLabel activity={a} size={18} />
							{needsAnnotation(a) && (
								<Badge color="orange" variant="light">
									needs annotation
								</Badge>
							)}
						</Group>
					</Card>
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 8 }}>
					<Card withBorder h="100%">
						<ActivityMetrics activity={a} />
					</Card>
				</Grid.Col>
			</Grid>

			{/* Detail charts + map — parsed on demand from the raw .fit */}
			{a.fit_path && streamsLoading && (
				<Card withBorder>
					<Center h={180}>
						<Loader />
					</Center>
				</Card>
			)}
			{(() => {
				const hasTrack = (streams?.track?.length ?? 0) > 0;
				const hasChart =
					(streams?.heart_rate?.length ?? 0) > 0 ||
					(streams?.elevation?.length ?? 0) > 0;
				if (!hasTrack && !hasChart) return null;
				return (
					<Grid>
						{hasTrack && (
							<Grid.Col span={{ base: 12, md: hasChart ? 6 : 12 }}>
								<RouteMap track={streams!.track} />
							</Grid.Col>
						)}
						{hasChart && (
							<Grid.Col span={{ base: 12, md: hasTrack ? 6 : 12 }}>
								<HrElevationChart
									hr={streams!.heart_rate}
									elevation={streams!.elevation}
								/>
							</Grid.Col>
						)}
					</Grid>
				);
			})()}

			{/* Annotation — full width, laid out wide (not a tall column) */}
			<Card withBorder>
				{category === "running" ? (
					<RunningAnnotation
						activity={a}
						foodOptions={foodOptions ?? []}
						onSave={(b) => save.mutate(b)}
					/>
				) : category === "climbing" || asClimbing ? (
					<ClimbingAnnotation activity={a} onSave={(b) => save.mutate(b)} />
				) : category === "strength" ? (
					<Stack gap="md">
						<Group justify="flex-end">
							<Button
								variant="light"
								size="xs"
								onClick={() => setAsClimbing(true)}
							>
								Log as climbing
							</Button>
						</Group>
						<StrengthAnnotation activity={a} onSave={(b) => save.mutate(b)} />
					</Stack>
				) : (
					<Text c="dimmed" size="sm">
						No annotations for this activity type yet.
					</Text>
				)}
			</Card>

			<Text size="xs" c="dimmed">
				Raw file: {a.fit_path ?? "not downloaded"}
			</Text>
		</Stack>
	);
}
