import { useEffect, useState } from "react";
import {
  Center,
  Input,
  SegmentedControl,
  SimpleGrid,
  Stack,
  TagsInput,
  Textarea,
} from "@mantine/core";

import type { Activity, Annotation } from "../api/types";
import {
  CAFFEINE_OPTIONS,
  needsSubtype,
  SCALE_OPTIONS,
  terrainOptions,
  WEATHER_OPTIONS,
} from "../activityTypes";

interface Props {
  activity: Activity;
  foodOptions: string[];
  onSave: (body: Annotation) => void;
}

// Bold field labels with a bit of breathing room above the control.
const labelStyles = {
  label: { marginBottom: "var(--mantine-spacing-xs)", fontWeight: 700 },
} as const;

const caffeineData = CAFFEINE_OPTIONS.map((c) => ({
  value: c,
  label: c[0].toUpperCase() + c.slice(1),
}));

export default function RunningAnnotation({ activity: a, foodOptions, onSave }: Props) {
  const weatherData = WEATHER_OPTIONS.map(({ value, icon: Icon, label }) => ({
    value,
    label: (
      <Center>
        <Icon size={18} aria-label={label} />
      </Center>
    ),
  }));

  // Free-text notes — buffered locally, saved on blur (not every keystroke).
  const [notes, setNotes] = useState(a.notes ?? "");
  useEffect(() => setNotes(a.notes ?? ""), [a.notes]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="md">
        <Input.Wrapper label="FEEL" styles={labelStyles}>
          <SegmentedControl
            fullWidth
            data={SCALE_OPTIONS}
            value={a.feeling ? String(a.feeling) : ""}
            onChange={(v) => onSave({ feeling: Number(v) })}
          />
        </Input.Wrapper>
        <Input.Wrapper label="INTENSITY" styles={labelStyles}>
          <SegmentedControl
            fullWidth
            data={SCALE_OPTIONS}
            value={a.effort ? String(a.effort) : ""}
            onChange={(v) => onSave({ effort: Number(v) })}
          />
        </Input.Wrapper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="md">
        <Input.Wrapper
          label="Terrain"
          styles={labelStyles}
          error={
            needsSubtype(a.activity_type, a.subtype) ? "Pick trail or mountain" : undefined
          }
        >
          <SegmentedControl
            fullWidth
            data={terrainOptions(a.activity_type)}
            value={a.subtype ?? ""}
            onChange={(v) => onSave({ subtype: v })}
          />
        </Input.Wrapper>
        <Input.Wrapper label="Caffeine" styles={labelStyles}>
          <SegmentedControl
            fullWidth
            data={caffeineData}
            value={a.caffeine ?? ""}
            onChange={(v) => onSave({ caffeine: v })}
          />
        </Input.Wrapper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" verticalSpacing="md">
        <Input.Wrapper label="Weather" styles={labelStyles}>
          <SegmentedControl
            fullWidth
            data={weatherData}
            value={a.weather ?? ""}
            onChange={(v) => onSave({ weather: v })}
          />
        </Input.Wrapper>
        <TagsInput
          label="Food during"
          placeholder="Add food…"
          data={foodOptions}
          value={a.food_during ?? []}
          onChange={(v) => onSave({ food_during: v })}
          clearable
          styles={labelStyles}
        />
        <TagsInput
          label="Food after"
          placeholder="Add food…"
          data={foodOptions}
          value={a.food_after ?? []}
          onChange={(v) => onSave({ food_after: v })}
          clearable
          styles={labelStyles}
        />
      </SimpleGrid>

      <Textarea
        label="Notes"
        placeholder="Anything else about this session…"
        autosize
        minRows={2}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        onBlur={() => notes !== (a.notes ?? "") && onSave({ notes })}
        styles={labelStyles}
      />
    </Stack>
  );
}
