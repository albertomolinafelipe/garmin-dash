import { useQuery } from "@tanstack/react-query";
import { Badge, Card, Center, Group, Loader, Text } from "@mantine/core";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../api/client";
import type { Activity } from "../api/types";
import { dayKey } from "../format";
import { kanagawa } from "../theme";

const WINDOW_DAYS = 7; // fixed trailing window
const SPAN_DAYS = 30; // how many days to plot

export interface PanelSeries {
  key: string; // dataKey + gradient id
  label: string; // tooltip / badge label
  unit: string; // e.g. "km", "m", "h"
  color: string;
  kind: "area" | "line"; // area = line + shaded fill; line = plain line
  axis?: "left" | "right"; // which Y axis (default left)
  // Contribution of one activity to its day, or null to skip it.
  valueOf: (a: Activity) => number | null;
}

interface Props {
  title: string;
  queryKey: string;
  series: PanelSeries[]; // 1 or 2 series
}

// Rolling WINDOW_DAYS total of `valueOf` for each of the last SPAN_DAYS days.
function rolling(activities: Activity[], valueOf: (a: Activity) => number | null) {
  const perDay = new Map<string, number>();
  for (const a of activities) {
    if (!a.start_time) continue;
    const v = valueOf(a);
    if (v == null) continue;
    const key = a.start_time.slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + v);
  }
  const today = new Date();
  const out: number[] = [];
  const labels: string[] = [];
  for (let i = SPAN_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    let sum = 0;
    for (let w = 0; w < WINDOW_DAYS; w++) {
      const d = new Date(day);
      d.setDate(day.getDate() - w);
      sum += perDay.get(dayKey(d)) ?? 0;
    }
    out.push(+sum.toFixed(1));
    labels.push(dayKey(day).slice(5));
  }
  return { out, labels };
}

export default function GrafanaLoadPanel({ title, queryKey, series }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["activities", queryKey],
    queryFn: () => api.listActivities({ limit: 500 }),
  });

  const activities = data ?? [];
  const cols = series.map((s) => rolling(activities, s.valueOf));
  const labels = cols[0]?.labels ?? [];
  const rows = labels.map((date, i) => {
    const row: Record<string, string | number> = { date };
    series.forEach((s, si) => {
      row[s.key] = cols[si].out[i];
    });
    return row;
  });
  const current = (si: number) =>
    rows.length ? (rows[rows.length - 1][series[si].key] as number) : 0;

  const axisFor = (s: PanelSeries) => s.axis ?? "left";
  const usesRight = series.some((s) => axisFor(s) === "right");

  return (
    <Card withBorder h={420}>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>{title}</Text>
        <Group gap="xs">
          {series.map((s, si) => (
            <Badge
              key={s.key}
              variant="light"
              styles={{ root: { color: s.color, borderColor: s.color } }}
            >
              {current(si)} {s.unit} / {WINDOW_DAYS}d
            </Badge>
          ))}
        </Group>
      </Group>
      <Text size="xs" c="dimmed" mb="sm">
        Rolling {WINDOW_DAYS}-day totals, last {SPAN_DAYS} days
      </Text>
      {isLoading ? (
        <Center h={300}>
          <Loader />
        </Center>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <defs>
              {series
                .filter((s) => s.kind === "area")
                .map((s) => (
                  <linearGradient
                    key={s.key}
                    id={`fill-${queryKey}-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
            </defs>
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
              yAxisId="left"
              tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
              stroke={kanagawa.sumiInk4}
              width={36}
            />
            {usesRight && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
                stroke={kanagawa.sumiInk4}
                width={40}
              />
            )}
            <Tooltip
              contentStyle={{
                background: kanagawa.sumiInk2,
                border: `1px solid ${kanagawa.sumiInk4}`,
                borderRadius: 8,
                color: kanagawa.fujiWhite,
                fontSize: 12,
              }}
              formatter={(v: number, key: string) => {
                const s = series.find((x) => x.key === key);
                return [`${v} ${s?.unit ?? ""}`, s?.label ?? key];
              }}
            />
            {series.map((s) =>
              s.kind === "area" ? (
                <Area
                  key={s.key}
                  yAxisId={axisFor(s)}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${queryKey}-${s.key})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ) : (
                <Line
                  key={s.key}
                  yAxisId={axisFor(s)}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
