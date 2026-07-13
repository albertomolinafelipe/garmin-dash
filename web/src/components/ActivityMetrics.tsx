import { Group, SimpleGrid, Text, ThemeIcon } from "@mantine/core";
import {
  IconBolt,
  IconClock,
  IconFlame,
  IconGauge,
  IconHeart,
  IconHeartbeat,
  IconMountain,
  IconRoute,
} from "@tabler/icons-react";

import type { Activity } from "../api/types";
import type { IconComponent } from "../activityTypes";
import { categoryColor, categoryOf } from "../activityTypes";
import { fmtDistance, fmtDuration, fmtPace } from "../format";

interface Metric {
  icon: IconComponent;
  label: string;
  value: string;
}

// Only include a metric when it actually has a value — so e.g. a strength session
// doesn't show "Avg pace —" or an empty elevation.
export default function ActivityMetrics({ activity: a }: { activity: Activity }) {
  const color = categoryColor[categoryOf(a.activity_type, a.subtype)];

  const metrics: (Metric | null)[] = [
    a.distance_m ? { icon: IconRoute, label: "Distance", value: fmtDistance(a.distance_m) } : null,
    a.duration_s ? { icon: IconClock, label: "Duration", value: fmtDuration(a.duration_s) } : null,
    a.distance_m && a.avg_speed_mps
      ? { icon: IconGauge, label: "Avg pace", value: fmtPace(a.avg_speed_mps) }
      : null,
    a.avg_hr ? { icon: IconHeartbeat, label: "Avg HR", value: `${a.avg_hr} bpm` } : null,
    a.max_hr ? { icon: IconHeart, label: "Max HR", value: `${a.max_hr} bpm` } : null,
    a.elevation_gain_m
      ? { icon: IconMountain, label: "Elevation", value: `${Math.round(a.elevation_gain_m)} m` }
      : null,
    a.calories ? { icon: IconFlame, label: "Calories", value: `${a.calories} kcal` } : null,
    a.avg_power_w ? { icon: IconBolt, label: "Avg power", value: `${a.avg_power_w} W` } : null,
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" verticalSpacing="md">
      {metrics.filter((m): m is Metric => m !== null).map((m) => (
        <Group key={m.label} gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="gray" size={38} radius="md">
            <m.icon size={20} stroke={1.6} color={color} />
          </ThemeIcon>
          <div>
            <Text fw={600} lh={1.15}>
              {m.value}
            </Text>
            <Text size="xs" c="dimmed">
              {m.label}
            </Text>
          </div>
        </Group>
      ))}
    </SimpleGrid>
  );
}
