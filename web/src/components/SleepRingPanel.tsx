import { useQuery } from "@tanstack/react-query";
import { Box, Card, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "../api/client";
import { fmtDuration } from "../format";
import { chartColors, kanagawa } from "../theme";

export default function SleepRingPanel() {
  const { data, isError, isLoading } = useQuery({
    queryKey: ["sleep", "latest"],
    queryFn: () => api.listSleep({ limit: 1 }),
  });

  const sleep = data?.[0];
  const stages = sleep
    ? [
        { name: "Deep", value: sleep.deep_sleep_s, color: chartColors.deep },
        { name: "Light", value: sleep.light_sleep_s, color: chartColors.light },
        { name: "REM", value: sleep.rem_sleep_s, color: chartColors.rem },
        { name: "Awake", value: sleep.awake_s, color: chartColors.awake },
      ].filter(
        (stage) =>
          typeof stage.value === "number" &&
          Number.isFinite(stage.value) &&
          stage.value > 0,
      )
    : [];

  return (
    <Card withBorder h={420}>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Last night</Text>
        {sleep && (
          <Text size="xs" c="dimmed">
            {sleep.calendar_date}
          </Text>
        )}
      </Group>

      {isLoading ? (
        <Center h={340}>
          <Loader />
        </Center>
      ) : isError ? (
        <Center h={340}>
          <Text c="red" ta="center">
            Could not load sleep data.
          </Text>
        </Center>
      ) : !sleep ? (
        <Center h={340}>
          <Text c="dimmed" ta="center">
            No sleep data yet — hit <b>Sync</b> to pull from Garmin.
          </Text>
        </Center>
      ) : (
        <Stack gap="sm" align="center">
          <Box pos="relative" w="100%" h={280}>
            {stages.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stages}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {stages.map((stage) => (
                      <Cell key={stage.name} fill={stage.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => fmtDuration(Number(value))}
                    contentStyle={{
                      background: kanagawa.sumiInk2,
                      border: `1px solid ${kanagawa.sumiInk4}`,
                      borderRadius: 8,
                      color: kanagawa.fujiWhite,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <Center pos="absolute" inset={0} style={{ pointerEvents: "none" }}>
              <Stack gap={0} align="center">
                <Text fw={700} fz="2rem" lh={1.1}>
                  {sleep.sleep_score ?? "—"}
                </Text>
                <Text size="sm" c="dimmed">
                  {fmtDuration(sleep.total_sleep_s)}
                </Text>
              </Stack>
            </Center>
          </Box>

          {stages.length > 0 ? (
            <Group gap="md" justify="center">
              {stages.map((stage) => (
                <Group key={stage.name} gap={5} wrap="nowrap">
                  <Box
                    w={8}
                    h={8}
                    style={{ borderRadius: "50%", background: stage.color }}
                  />
                  <Text size="xs" c="dimmed">
                    {stage.name}
                  </Text>
                </Group>
              ))}
            </Group>
          ) : (
            <Text size="sm" c="dimmed" ta="center">
              No stage breakdown available.
            </Text>
          )}
        </Stack>
      )}
    </Card>
  );
}
