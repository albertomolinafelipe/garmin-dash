import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	ActionIcon,
	Autocomplete,
	Button,
	Group,
	Input,
	NumberInput,
	SegmentedControl,
	SimpleGrid,
	Stack,
	Text,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";

import { api } from "../api/client";
import type { Activity, Annotation, StrengthEntry } from "../api/types";
import { SCALE_OPTIONS } from "../activityTypes";

interface Props {
	activity: Activity;
	onSave: (body: Annotation) => void;
}

const labelStyles = {
	label: { marginBottom: "var(--mantine-spacing-xs)", fontWeight: 700 },
} as const;

const emptyRow: StrengthEntry = {
	exercise: "",
	sets: null,
	reps: null,
	weight: null,
};

export default function StrengthAnnotation({ activity: a, onSave }: Props) {
	const { data: catalog } = useQuery({
		queryKey: ["exercises"],
		queryFn: () => api.exercises(),
	});
	const options = (catalog ?? []).map((e) => e.name);

	// Local editing buffer; committed to the API on discrete edits / blur.
	const [rows, setRows] = useState<StrengthEntry[]>([]);
	useEffect(() => {
		setRows(a.strength_exercises ?? []);
	}, [a.id]);

	const commit = (next: StrengthEntry[]) => {
		setRows(next);
		onSave({ strength_exercises: next });
	};
	const setLocal = (i: number, patch: Partial<StrengthEntry>) =>
		setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

	return (
		<Stack gap="lg">
			<SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="md">
				<Input.Wrapper label="FEEL" styles={labelStyles}>
					<SegmentedControl
						fullWidth
						data={SCALE_OPTIONS}
						value={a.feeling ? String(a.feeling) : ""}
						onChange={(v) => onSave({ feeling: Number(v) })}
					/>
				</Input.Wrapper>
				<Input.Wrapper label="INTENSITY" styles={labelStyles}>
					<SegmentedControl
						fullWidth
						data={SCALE_OPTIONS}
						value={a.effort ? String(a.effort) : ""}
						onChange={(v) => onSave({ effort: Number(v) })}
					/>
				</Input.Wrapper>
			</SimpleGrid>

			<Input.Wrapper label="WORKOUT" styles={labelStyles}>
				<Stack gap="xs">
					{rows.length > 0 && (
						<Group gap="xs" wrap="nowrap" px={4}>
							<Text size="xs" c="dimmed" style={{ flex: 1 }}>
								Exercise
							</Text>
							<Text size="xs" c="dimmed" w={70} ta="center">
								Sets
							</Text>
							<Text size="xs" c="dimmed" w={70} ta="center">
								Reps
							</Text>
							<Text size="xs" c="dimmed" w={90} ta="center">
								Weight
							</Text>
							<div style={{ width: 28 }} />
						</Group>
					)}
					{rows.map((row, i) => (
						<Group key={i} gap="xs" wrap="nowrap">
							<Autocomplete
								style={{ flex: 1 }}
								data={options}
								placeholder="Exercise"
								value={row.exercise}
								onChange={(v) => setLocal(i, { exercise: v })}
								onBlur={() => commit(rows)}
							/>
							<NumberInput
								w={70}
								min={0}
								hideControls
								placeholder="—"
								value={row.sets ?? ""}
								onChange={(v) =>
									setLocal(i, { sets: v === "" ? null : Number(v) })
								}
								onBlur={() => commit(rows)}
							/>
							<NumberInput
								w={70}
								min={0}
								hideControls
								placeholder="—"
								value={row.reps ?? ""}
								onChange={(v) =>
									setLocal(i, { reps: v === "" ? null : Number(v) })
								}
								onBlur={() => commit(rows)}
							/>
							<NumberInput
								w={90}
								min={0}
								step={0.5}
								hideControls
								placeholder="BW"
								value={row.weight ?? ""}
								onChange={(v) =>
									setLocal(i, { weight: v === "" ? null : Number(v) })
								}
								onBlur={() => commit(rows)}
							/>
							<ActionIcon
								variant="subtle"
								color="red"
								aria-label="Remove exercise"
								onClick={() => commit(rows.filter((_, j) => j !== i))}
							>
								<IconTrash size={16} />
							</ActionIcon>
						</Group>
					))}
					<Group justify="space-between">
						<Button
							variant="light"
							size="xs"
							leftSection={<IconPlus size={14} />}
							onClick={() => commit([...rows, { ...emptyRow }])}
						>
							Add exercise
						</Button>
						{rows.length === 0 && (
							<Text size="xs" c="dimmed">
								Weight blank = bodyweight.
							</Text>
						)}
					</Group>
				</Stack>
			</Input.Wrapper>
		</Stack>
	);
}
