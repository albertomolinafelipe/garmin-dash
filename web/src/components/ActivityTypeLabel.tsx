import { Badge, Group, Text } from "@mantine/core";

import type { Activity } from "../api/types";
import {
  categoryIcon,
  categoryOf,
  needsSubtype,
  typeLabel,
} from "../activityTypes";

interface Props {
  activity: Activity;
  size?: number;
}

// Icon + human label for an activity's type, with a "needs type" flag when a
// climbing activity is still missing its (hand-set) subtype.
export default function ActivityTypeLabel({ activity, size = 16 }: Props) {
  const Icon = categoryIcon[categoryOf(activity.activity_type, activity.subtype)];
  const needs = needsSubtype(activity.activity_type, activity.subtype);

  return (
    <Group gap={6} wrap="nowrap">
      <Icon size={size} stroke={1.5} />
      <Text size="sm">{typeLabel(activity.activity_type, activity.subtype)}</Text>
      {needs && (
        <Badge size="xs" color="orange" variant="light">
          needs type
        </Badge>
      )}
    </Group>
  );
}
