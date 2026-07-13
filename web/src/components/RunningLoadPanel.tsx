import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@mantine/charts";
import { Badge, Card, Center, Group, Loader, Text } from "@mantine/core";

import { api } from "../api/client";
import type { Activity } from "../api/types";
import { dayKey } from "../format";
import { chartColors } from "../theme";

const WINDOW_DAYS = 7; // trailing window summed into each bar
const SPAN_DAYS = 30; // how many days (bars) to show

const isRunning = (t: string | null) => !!t && t.includes("running");

function buildLoad(activities: Activity[]) {
  // km run per calendar day
  const perDay = new Map<string, number>();
  for (const a of activities) {
    if (!isRunning(a.activity_type) || !a.start_time || !a.distance_m) continue;
    const key = a.start_time.slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + a.distance_m / 1000);
  }

  // For each of the last SPAN_DAYS days, sum the trailing WINDOW_DAYS of km.
  const today = new Date();
  const bars: { date: string; km: number }[] = [];
  for (let i = SPAN_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    let sum = 0;
    for (let w = 0; w < WINDOW_DAYS; w++) {
      const d = new Date(day);
      d.setDate(day.getDate() - w);
      sum += perDay.get(dayKey(d)) ?? 0;
    }
    bars.push({ date: dayKey(day).slice(5), km: +sum.toFixed(1) });
  }
  return bars;
}

export default function RunningLoadPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["activities", "running-load"],
    queryFn: () => api.listActivities({ limit: 500 }),
  });

  const bars = buildLoad(data ?? []);
  const current = bars.length ? bars[bars.length - 1].km : 0;

  return (
    <Card withBorder h={420}>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Running load</Text>
        <Badge variant="light" color="kanagawa">
          {current} km / 7d
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Rolling {WINDOW_DAYS}-day distance, last {SPAN_DAYS} days
      </Text>
      {isLoading ? (
        <Center h={300}>
          <Loader />
        </Center>
      ) : (
        <BarChart
          h={300}
          data={bars}
          dataKey="date"
          unit=" km"
          series={[{ name: "km", color: chartColors.load }]}
          xAxisProps={{ interval: 4 }}
          withYAxis
        />
      )}
    </Card>
  );
}
