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
import { needsAnnotation } from "../activityTypes";
import RunningLoadPanel from "../components/RunningLoadPanel";

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["activities", "all"],
    queryFn: () => api.listActivities({ limit: 500 }),
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
        <Grid.Col span={{ base: 12, md: 6 }}>
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
                {activities.length === 0 && (
                  <Text c="dimmed" ta="center" p="xl">
                    All caught up — nothing left to annotate. 🎉
                  </Text>
                )}
              </Stack>
            </ScrollArea>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <RunningLoadPanel />
        </Grid.Col>
      </Grid>
    </>
  );
}
