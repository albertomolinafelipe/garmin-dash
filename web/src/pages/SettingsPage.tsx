import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	Button,
	Card,
	Code,
	Group,
	Loader,
	Stack,
	Text,
	Textarea,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDeviceFloppy } from "@tabler/icons-react";

import { api } from "../api/client";
import { queryClient } from "../queryClient";

export default function SettingsPage() {
	const { data, isLoading } = useQuery({
		queryKey: ["exercises", "raw"],
		queryFn: () => api.exercisesRaw(),
	});

	const [text, setText] = useState("");
	useEffect(() => {
		if (data != null) setText(data);
	}, [data]);

	const save = useMutation({
		mutationFn: () => api.saveExercisesRaw(text),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["exercises"] });
			notifications.show({
				title: "Saved",
				message: "Exercise catalog updated.",
				color: "green",
			});
		},
		onError: (e: any) =>
			notifications.show({
				title: "Save failed",
				message: e?.response?.data?.detail ?? String(e),
				color: "red",
			}),
	});

	const dirty = data != null && text !== data;

	return (
		<Stack>
			<Card withBorder>
				<Stack gap="sm">
					<div>
						<Text fw={700}>Exercise catalog</Text>
						<Text size="sm" c="dimmed">
							The list of exercises suggested when annotating strength workouts.
							Edit the raw YAML: a top-level <Code>exercises</Code> list, each
							entry with a <Code>name</Code> and optional{" "}
							<Code>categories</Code> tags (e.g.{" "}
							<Code>[push, calisthenics]</Code>).
						</Text>
					</div>
					{isLoading ? (
						<Loader />
					) : (
						<Textarea
							autosize
							minRows={12}
							maxRows={30}
							value={text}
							onChange={(e) => setText(e.currentTarget.value)}
							styles={{ input: { fontFamily: "monospace" } }}
						/>
					)}
					<Group justify="flex-end">
						<Button
							leftSection={<IconDeviceFloppy size={16} />}
							loading={save.isPending}
							disabled={!dirty}
							onClick={() => save.mutate()}
						>
							Save
						</Button>
					</Group>
				</Stack>
			</Card>
		</Stack>
	);
}
