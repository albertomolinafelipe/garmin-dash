import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Center, Group, Loader, Text } from "@mantine/core";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../api/client";
import type { Activity, Sleep } from "../api/types";
import { dayKey } from "../format";
import { kanagawa } from "../theme";

const SPAN_DAYS = 30; // how many days to plot
const WINDOW_DAYS = 7; // trailing window for the rolling mean (matches load panels)

const INTENSITY = kanagawa.waveRed;
const FEEL = kanagawa.springGreen;
const SLEEP = kanagawa.crystalBlue;

// Collect a 1–5 annotation field per calendar day (a day may hold several values).
function perDay(activities: Activity[], valueOf: (a: Activity) => number | null) {
  const agg = new Map<string, number[]>();
  for (const a of activities) {
    if (!a.start_time) continue;
    const v = valueOf(a);
    if (v == null) continue;
    const key = a.start_time.slice(0, 10);
    (agg.get(key) ?? agg.set(key, []).get(key)!).push(v);
  }
  return agg;
}

export default function WellbeingPanel() {
  const activitiesQ = useQuery({
    queryKey: ["activities", "wellbeing"],
    queryFn: () => api.listActivities({ limit: 500 }),
  });
  const sleepQ = useQuery({
    queryKey: ["sleep", "wellbeing"],
    queryFn: () => api.listSleep({ limit: 500 }),
  });

  const isLoading = activitiesQ.isLoading || sleepQ.isLoading;
  const activities = activitiesQ.data ?? [];
  const sleep = sleepQ.data ?? [];

  const intensity = perDay(activities, (a) => a.effort);
  const feel = perDay(activities, (a) => a.feeling);
  const sleepByDate = new Map<string, number>();
  for (const s of sleep as Sleep[]) {
    if (s.sleep_score != null) sleepByDate.set(s.calendar_date, s.sleep_score);
  }

  // Mean of every rating that falls in the trailing WINDOW_DAYS ending on `day`.
  const rollingMean = (m: Map<string, number[]>, day: Date) => {
    const vals: number[] = [];
    for (let w = 0; w < WINDOW_DAYS; w++) {
      const d = new Date(day);
      d.setDate(day.getDate() - w);
      const got = m.get(dayKey(d));
      if (got) vals.push(...got);
    }
    if (!vals.length) return null;
    return +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2);
  };

  const today = new Date();
  const rows: {
    date: string;
    intensity: number | null;
    feel: number | null;
    sleep: number | null;
  }[] = [];
  for (let i = SPAN_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = dayKey(day);
    rows.push({
      date: key.slice(5),
      intensity: rollingMean(intensity, day),
      feel: rollingMean(feel, day),
      sleep: sleepByDate.get(key) ?? null,
    });
  }

  return (
    <Card withBorder h={420}>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Wellbeing</Text>
        <Group gap="xs">
          <Badge variant="light" styles={{ root: { color: INTENSITY } }}>
            Intensity
          </Badge>
          <Badge variant="light" styles={{ root: { color: FEEL } }}>
            Feel
          </Badge>
          <Badge variant="light" styles={{ root: { color: SLEEP } }}>
            Sleep
          </Badge>
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        {WINDOW_DAYS}-day avg intensity &amp; feel (1–5), sleep score, last {SPAN_DAYS}{" "}
        days
      </Text>
      {isLoading ? (
        <Center h={300}>
          <Loader />
        </Center>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid
              stroke={kanagawa.sumiInk3}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              interval={4}
              tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
              stroke={kanagawa.sumiInk4}
            />
            <YAxis
              yAxisId="scale"
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
              stroke={kanagawa.sumiInk4}
              width={24}
            />
            <YAxis
              yAxisId="sleep"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
              stroke={kanagawa.sumiInk4}
              width={32}
            />
            <Tooltip
              contentStyle={{
                background: kanagawa.sumiInk2,
                border: `1px solid ${kanagawa.sumiInk4}`,
                borderRadius: 8,
                color: kanagawa.fujiWhite,
                fontSize: 12,
              }}
            />
            <Line
              yAxisId="scale"
              type="monotone"
              dataKey="intensity"
              name="Intensity"
              stroke={INTENSITY}
              strokeWidth={2}
              connectNulls
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="scale"
              type="monotone"
              dataKey="feel"
              name="Feel"
              stroke={FEEL}
              strokeWidth={2}
              connectNulls
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Scatter
              yAxisId="sleep"
              dataKey="sleep"
              name="Sleep"
              fill={SLEEP}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
