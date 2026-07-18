import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Badge,
	Button,
	Card,
	Center,
	Group,
	Loader,
	MultiSelect,
	RangeSlider,
	Select,
	Stack,
	Table,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { Activity } from "../api/types";
import { fmtDate, fmtDistance, fmtDuration } from "../format";
import {
	CLIMBING_SUBTYPES,
	RUNNING_SUBTYPES,
	categoryColor,
	categoryOf,
	effectiveSubtype,
	needsAnnotation,
} from "../activityTypes";
import ActivityTypeLabel from "../components/ActivityTypeLabel";

type MetricRange = [number, number];

type MetricBounds = {
	range: MetricRange;
	disabled: boolean;
	step: number;
};

// Sliders use display units: 1 km, 50 m elevation, and 5 minutes.
const DISTANCE_STEP = 1;
const ELEVATION_STEP = 50;
const DURATION_STEP = 5;

function metricBounds(
	values: Array<number | null>,
	step: number,
): MetricBounds {
	const finiteValues = values.filter(
		(value): value is number => value != null && Number.isFinite(value),
	);

	if (finiteValues.length === 0) {
		return { range: [0, step], disabled: true, step };
	}

	const rawMin = Math.min(...finiteValues);
	const rawMax = Math.max(...finiteValues);
	const min = Math.floor(rawMin / step) * step;
	const quantizedMax = Math.ceil(rawMax / step) * step;
	const max = quantizedMax === min ? min + step : quantizedMax;

	return { range: [min, max], disabled: rawMin === rawMax, step };
}

function clampRange(
	current: MetricRange | null,
	bounds: MetricBounds,
): MetricRange | null {
	if (current === null) return null;
	const [min, max] = bounds.range;
	const lo = Math.max(min, Math.min(current[0], max));
	const hi = Math.max(lo, Math.min(current[1], max));
	return [lo, hi];
}

function displayMetric(value: number | null, divisor = 1): number | null {
	const converted = value == null ? Number.NaN : value / divisor;
	return Number.isFinite(converted) ? converted : null;
}

function inActiveRange(
	value: number | null,
	range: MetricRange | null,
): boolean {
	if (range === null) return true;
	return value !== null && value >= range[0] && value <= range[1];
}

function ActivitiesListContent({ activities }: { activities: Activity[] }) {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<string | null>(null);
	const [subtypes, setSubtypes] = useState<string[]>([]);
	const [distanceKm, setDistanceKm] = useState<MetricRange | null>(null);
	const [elevationM, setElevationM] = useState<MetricRange | null>(null);
	const [durationMin, setDurationMin] = useState<MetricRange | null>(null);

	const categoryOptions = useMemo(
		() =>
			Array.from(
				new Set(
					activities.map((activity) =>
						categoryOf(activity.activity_type, activity.subtype),
					),
				),
			)
				.sort()
				.map((value) => ({
					value,
					label: value.charAt(0).toUpperCase() + value.slice(1),
				})),
		[activities],
	);

	const bounds = useMemo(
		() => ({
			distance: metricBounds(
				activities.map((activity) => displayMetric(activity.distance_m, 1000)),
				DISTANCE_STEP,
			),
			elevation: metricBounds(
				activities.map((activity) => displayMetric(activity.elevation_gain_m)),
				ELEVATION_STEP,
			),
			duration: metricBounds(
				activities.map((activity) => displayMetric(activity.duration_s, 60)),
				DURATION_STEP,
			),
		}),
		[activities],
	);

	useEffect(() => {
		setDistanceKm((current) => clampRange(current, bounds.distance));
		setElevationM((current) => clampRange(current, bounds.elevation));
		setDurationMin((current) => clampRange(current, bounds.duration));
	}, [bounds]);

	const filtered = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();

		return activities.filter((activity) => {
			if (!(activity.name ?? "").toLowerCase().includes(normalizedSearch))
				return false;

			const activityCategory = categoryOf(
				activity.activity_type,
				activity.subtype,
			);
			if (category !== null && activityCategory !== category) return false;

			if (subtypes.length > 0) {
				const subtype =
					category === "running"
						? effectiveSubtype(activity.activity_type, activity.subtype)
						: activity.subtype;
				if (subtype === null || !subtypes.includes(subtype)) return false;
			}

			return (
				inActiveRange(displayMetric(activity.distance_m, 1000), distanceKm) &&
				inActiveRange(displayMetric(activity.elevation_gain_m), elevationM) &&
				inActiveRange(displayMetric(activity.duration_s, 60), durationMin)
			);
		});
	}, [
		activities,
		category,
		distanceKm,
		durationMin,
		elevationM,
		search,
		subtypes,
	]);

	const activeFilterCount =
		Number(search.trim().length > 0) +
		Number(category !== null) +
		Number(subtypes.length > 0) +
		Number(distanceKm !== null) +
		Number(elevationM !== null) +
		Number(durationMin !== null);

	const clearFilters = () => {
		setSearch("");
		setCategory(null);
		setSubtypes([]);
		setDistanceKm(null);
		setElevationM(null);
		setDurationMin(null);
	};

	const subtypeOptions =
		category === "running"
			? RUNNING_SUBTYPES.map((value) => ({ value, label: value }))
			: CLIMBING_SUBTYPES.map((value) => ({ value, label: value }));

	return (
		<>
			<Title order={3} mb="md">
				List
			</Title>
			<Stack gap="md" mb="md">
				<Group align="flex-end" wrap="wrap">
					<TextInput
						label="Search by name"
						placeholder="Activity name"
						value={search}
						onChange={(event) => setSearch(event.currentTarget.value)}
						style={{ flex: "1 1 220px" }}
					/>
					<Select
						clearable
						label="Category"
						placeholder="All categories"
						data={categoryOptions}
						value={category}
						onChange={(value) => {
							setCategory(value);
							setSubtypes([]);
						}}
						style={{ flex: "1 1 180px" }}
					/>
					{(category === "running" || category === "climbing") && (
						<MultiSelect
							clearable
							label={
								category === "running" ? "Running subtype" : "Climbing subtype"
							}
							placeholder="All subtypes"
							data={subtypeOptions}
							value={subtypes}
							onChange={setSubtypes}
							style={{ flex: "1 1 240px" }}
						/>
					)}
					<Group gap="xs" align="center" h={36}>
						{activeFilterCount > 0 && (
							<Badge variant="light">{activeFilterCount} active</Badge>
						)}
						<Button
							variant="light"
							disabled={activeFilterCount === 0}
							onClick={clearFilters}
						>
							Clear
						</Button>
					</Group>
				</Group>
				<Group align="flex-start" wrap="wrap">
					<Stack
						gap={4}
						style={{
							flex: "1 1 220px",
							opacity: bounds.distance.disabled ? 0.5 : 1,
						}}
					>
						<Group justify="space-between" gap="xs">
							<Text size="sm" fw={500}>
								Distance
							</Text>
							<Text size="sm" c="dimmed">
								{(distanceKm ?? bounds.distance.range).join("–")} km
							</Text>
						</Group>
						<RangeSlider
							min={bounds.distance.range[0]}
							max={bounds.distance.range[1]}
							step={bounds.distance.step}
							minRange={bounds.distance.disabled ? 0 : bounds.distance.step}
							value={distanceKm ?? bounds.distance.range}
							onChange={setDistanceKm}
							disabled={bounds.distance.disabled}
							thumbFromLabel="Minimum distance"
							thumbToLabel="Maximum distance"
						/>
					</Stack>
					<Stack
						gap={4}
						style={{
							flex: "1 1 220px",
							opacity: bounds.elevation.disabled ? 0.5 : 1,
						}}
					>
						<Group justify="space-between" gap="xs">
							<Text size="sm" fw={500}>
								Elevation gain
							</Text>
							<Text size="sm" c="dimmed">
								{(elevationM ?? bounds.elevation.range).join("–")} m
							</Text>
						</Group>
						<RangeSlider
							min={bounds.elevation.range[0]}
							max={bounds.elevation.range[1]}
							step={bounds.elevation.step}
							minRange={bounds.elevation.disabled ? 0 : bounds.elevation.step}
							value={elevationM ?? bounds.elevation.range}
							onChange={setElevationM}
							disabled={bounds.elevation.disabled}
							thumbFromLabel="Minimum elevation gain"
							thumbToLabel="Maximum elevation gain"
						/>
					</Stack>
					<Stack
						gap={4}
						style={{
							flex: "1 1 220px",
							opacity: bounds.duration.disabled ? 0.5 : 1,
						}}
					>
						<Group justify="space-between" gap="xs">
							<Text size="sm" fw={500}>
								Duration
							</Text>
							<Text size="sm" c="dimmed">
								{(durationMin ?? bounds.duration.range).join("–")} min
							</Text>
						</Group>
						<RangeSlider
							min={bounds.duration.range[0]}
							max={bounds.duration.range[1]}
							step={bounds.duration.step}
							minRange={bounds.duration.disabled ? 0 : bounds.duration.step}
							value={durationMin ?? bounds.duration.range}
							onChange={setDurationMin}
							disabled={bounds.duration.disabled}
							thumbFromLabel="Minimum duration"
							thumbToLabel="Maximum duration"
						/>
					</Stack>
				</Group>
			</Stack>
			<Card withBorder padding={0} className="table-panel">
				<Table
					className="grafana-table"
					highlightOnHover
					stickyHeader
					borderColor="var(--mantine-color-dark-5)"
					verticalSpacing="sm"
				>
					<Table.Thead>
						<Table.Tr>
							<Table.Th w={12} p={0} />
							<Table.Th>Date</Table.Th>
							<Table.Th>Name</Table.Th>
							<Table.Th>Type</Table.Th>
							<Table.Th>Distance</Table.Th>
							<Table.Th>Duration</Table.Th>
							<Table.Th>Avg HR</Table.Th>
							<Table.Th>Status</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{filtered.map((a) => (
							<Table.Tr
								key={a.id}
								style={{ cursor: "pointer" }}
								onClick={() => navigate(`/activities/${a.id}`)}
							>
								<Table.Td w={12} p={0}>
									<div
										style={{
											width: 4,
											height: 20,
											margin: "0 auto",
											borderRadius: 2,
											backgroundColor:
												categoryColor[categoryOf(a.activity_type, a.subtype)],
										}}
									/>
								</Table.Td>
								<Table.Td>{fmtDate(a.start_time)}</Table.Td>
								<Table.Td>{a.name ?? "—"}</Table.Td>
								<Table.Td>
									<ActivityTypeLabel activity={a} />
								</Table.Td>
								<Table.Td>{fmtDistance(a.distance_m)}</Table.Td>
								<Table.Td>{fmtDuration(a.duration_s)}</Table.Td>
								<Table.Td>{a.avg_hr ?? "—"}</Table.Td>
								<Table.Td>
									{needsAnnotation(a) ? (
										<Badge color="orange" variant="light">
											needs annotation
										</Badge>
									) : (
										""
									)}
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
				{activities.length === 0 && (
					<Text c="dimmed" ta="center" p="xl">
						No activities yet — hit <b>Sync</b> to pull from Garmin.
					</Text>
				)}
				{filtered.length === 0 && activities.length > 0 && (
					<Text c="dimmed" ta="center" p="xl">
						No activities match the current filters.
					</Text>
				)}
			</Card>
		</>
	);
}

export default function ActivitiesPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["activities"],
		queryFn: () => api.listActivities({ limit: 200 }),
	});

	if (isLoading)
		return (
			<Center h={200}>
				<Loader />
			</Center>
		);

	return <ActivitiesListContent activities={data ?? []} />;
}
