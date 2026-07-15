import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
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
import RunningAnnotation from "../components/RunningAnnotation";
import ClimbingAnnotation from "../components/ClimbingAnnotation";

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

  const save = useMutation({
    mutationFn: (body: Annotation) => api.updateActivity(activityId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["food-options"] });
    },
    onError: (e: unknown) =>
      notifications.show({ title: "Save failed", message: String(e), color: "red" }),
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
      {/* Header — category color accent, like the calendar */}
      <Card withBorder style={{ borderLeft: `4px solid ${color}` }}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            variant="unstyled"
            style={{ flex: 1 }}
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmName()}
            placeholder="Activity name"
            styles={{ input: { fontSize: "var(--mantine-font-size-xl)", fontWeight: 700 } }}
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

      {/* Metrics — full width */}
      <Card withBorder>
        <ActivityMetrics activity={a} />
      </Card>

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
        ) : (
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              No annotations for this activity type yet.
            </Text>
            {category === "strength" && (
              <Button variant="light" size="xs" onClick={() => setAsClimbing(true)}>
                Log as climbing
              </Button>
            )}
          </Group>
        )}
      </Card>

      <Text size="xs" c="dimmed">
        Raw file: {a.fit_path ?? "not downloaded"}
      </Text>
    </Stack>
  );
}
