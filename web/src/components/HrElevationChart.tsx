import { Card, Group, Text } from "@mantine/core";
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

import type { Sample } from "../api/types";
import { kanagawa } from "../theme";
import { clock } from "../format";

const HR = kanagawa.waveRed;
const ELEV = kanagawa.waveAqua2;

// Merge the two streams on their shared elapsed-time key.
function merge(hr: Sample[], elev: Sample[]) {
  const m = new Map<number, { t: number; hr?: number; elev?: number }>();
  for (const p of hr) m.set(p.t, { t: p.t, hr: p.v });
  for (const p of elev) {
    const row = m.get(p.t) ?? { t: p.t };
    row.elev = p.v;
    m.set(p.t, row);
  }
  return [...m.values()].sort((a, b) => a.t - b.t);
}

export default function HrElevationChart({
  hr,
  elevation,
}: {
  hr: Sample[];
  elevation: Sample[];
}) {
  const data = merge(hr, elevation);
  const hrValues = hr.map((p) => p.v);
  const hasHr = hrValues.length > 0;
  const hasElev = elevation.length > 0;

  return (
    <Card withBorder h="100%">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>{hasElev ? "Heart rate & elevation" : "Heart rate"}</Text>
        <Group gap="md">
          {hasHr && (
            <Text size="xs" style={{ color: HR }}>
              avg {Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length)} ·
              max {Math.max(...hrValues)} bpm
            </Text>
          )}
          {hasElev && (
            <Text size="xs" style={{ color: ELEV }}>
              {Math.round(Math.min(...elevation.map((p) => p.v)))}–
              {Math.round(Math.max(...elevation.map((p) => p.v)))} m
            </Text>
          )}
        </Group>
      </Group>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="elevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ELEV} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ELEV} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={HR} stopOpacity={0.35} />
              <stop offset="100%" stopColor={HR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={kanagawa.sumiInk3} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[0, "dataMax"]}
            tickFormatter={clock}
            tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
            stroke={kanagawa.sumiInk4}
            minTickGap={40}
          />
          {/* Left axis: HR (bpm) */}
          <YAxis
            yAxisId="hr"
            domain={[
              Math.floor(Math.min(...hrValues, Infinity) / 10) * 10 - 5,
              Math.ceil(Math.max(...hrValues, -Infinity) / 10) * 10 + 5,
            ]}
            tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
            stroke={kanagawa.sumiInk4}
            width={32}
            allowDecimals={false}
            hide={!hasHr}
          />
          {/* Right axis: elevation (m) */}
          <YAxis
            yAxisId="elev"
            orientation="right"
            domain={["dataMin - 5", "dataMax + 5"]}
            tick={{ fill: kanagawa.fujiGray, fontSize: 11 }}
            stroke={kanagawa.sumiInk4}
            width={36}
            allowDecimals={false}
            hide={!hasElev}
          />
          <Tooltip
            contentStyle={{
              background: kanagawa.sumiInk2,
              border: `1px solid ${kanagawa.sumiInk4}`,
              borderRadius: 8,
              color: kanagawa.fujiWhite,
              fontSize: 12,
            }}
            labelFormatter={(t) => clock(Number(t))}
            formatter={(v: number, name: string) =>
              name === "hr" ? [`${v} bpm`, "HR"] : [`${v} m`, "Elevation"]
            }
          />
          {hasElev && (
            <Area
              yAxisId="elev"
              type="monotone"
              dataKey="elev"
              stroke={ELEV}
              strokeWidth={1.5}
              fill="url(#elevFill)"
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {/* HR is a plain line when overlaid on the elevation area, but a shaded
              area of its own when it's the only stream (e.g. indoor activities). */}
          {hasHr &&
            (hasElev ? (
              <Line
                yAxisId="hr"
                type="monotone"
                dataKey="hr"
                stroke={HR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls
              />
            ) : (
              <Area
                yAxisId="hr"
                type="monotone"
                dataKey="hr"
                stroke={HR}
                strokeWidth={2}
                fill="url(#hrFill)"
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
                connectNulls
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
