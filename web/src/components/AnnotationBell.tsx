import { useQuery } from "@tanstack/react-query";
import {
	ActionIcon,
	Group,
	Indicator,
	Popover,
	ScrollArea,
	Stack,
	Text,
	UnstyledButton,
} from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { fmtDate, fmtDistance } from "../format";
import { needsAnnotation } from "../activityTypes";

export default function AnnotationBell() {
	const navigate = useNavigate();
	const { data } = useQuery({
		queryKey: ["activities", "all"],
		queryFn: () => api.listActivities({ limit: 500 }),
	});

	const pending = (data ?? []).filter(needsAnnotation);
	const count = pending.length;

	return (
		<Popover width={320} position="bottom-end" shadow="md" withArrow>
			<Popover.Target>
				<Indicator
					label={count}
					size={16}
					color="orange"
					disabled={count === 0}
					offset={4}
				>
					<ActionIcon variant="subtle" size="lg" aria-label="Needs annotation">
						<IconBell size={20} />
					</ActionIcon>
				</Indicator>
			</Popover.Target>
			<Popover.Dropdown p="xs">
				<Text fw={600} size="sm" px="xs" pb="xs">
					Needs annotation
				</Text>
				{count === 0 ? (
					<Text c="dimmed" size="sm" px="xs" pb="xs">
						All caught up.
					</Text>
				) : (
					<ScrollArea.Autosize mah={360}>
						<Stack gap={2}>
							{pending.map((a) => (
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
										<Text size="xs" c="dimmed">
											{fmtDistance(a.distance_m)}
										</Text>
									</Group>
								</UnstyledButton>
							))}
						</Stack>
					</ScrollArea.Autosize>
				)}
			</Popover.Dropdown>
		</Popover>
	);
}
