import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Anchor,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  SimpleGrid,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Link, useParams } from "react-router-dom";

import { api } from "../api/client";
import { queryClient } from "../queryClient";
import type { Annotation } from "../api/types";
import { fmtDate, fmtDistance, fmtDuration, fmtPace } from "../format";
import AnnotationForm from "../components/AnnotationForm";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Card>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams();
  const activityId = Number(id);

  const { data: a, isLoading } = useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => api.getActivity(activityId),
  });

  const save = useMutation({
    mutationFn: (body: Annotation) => api.updateActivity(activityId, body),
    onSuccess: () => {
      notifications.show({ message: "Saved", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });

  if (isLoading || !a)
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );

  return (
    <>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>{a.name ?? "Activity"}</Title>
          <Text c="dimmed">{fmtDate(a.start_time)}</Text>
        </div>
        <Anchor component={Link} to="/">
          ← Back
        </Anchor>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, md: 7 }}>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <Stat label="Type" value={a.activity_type ?? "—"} />
            <Stat label="Distance" value={fmtDistance(a.distance_m)} />
            <Stat label="Duration" value={fmtDuration(a.duration_s)} />
            <Stat label="Avg pace" value={fmtPace(a.avg_speed_mps)} />
            <Stat label="Avg HR" value={a.avg_hr ?? "—"} />
            <Stat label="Max HR" value={a.max_hr ?? "—"} />
            <Stat label="Elev gain" value={a.elevation_gain_m ? `${Math.round(a.elevation_gain_m)} m` : "—"} />
            <Stat label="Calories" value={a.calories ?? "—"} />
            <Stat label="Avg power" value={a.avg_power_w ? `${a.avg_power_w} W` : "—"} />
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt="sm">
            Raw file: {a.fit_path ?? "not downloaded"}
          </Text>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder>
            <Title order={5} mb="sm">
              Your notes
            </Title>
            <AnnotationForm
              initial={a}
              saving={save.isPending}
              onSave={(v) => save.mutate(v)}
            />
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
