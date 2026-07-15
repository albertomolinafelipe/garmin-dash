import { useEffect, useState } from "react";
import {
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
} from "@mantine/core";

import type { Activity, Annotation } from "../api/types";
import { CLIMBING_FOCUS, CLIMBING_SUBTYPES, SCALE_OPTIONS } from "../activityTypes";

interface Props {
  activity: Activity;
  onSave: (body: Annotation) => void;
}

// Bold field labels with breathing room above the control.
const labelStyles = {
  label: { marginBottom: "var(--mantine-spacing-xs)", fontWeight: 700 },
} as const;

const typeData = CLIMBING_SUBTYPES.map((s) => ({
  value: s,
  label: s[0].toUpperCase() + s.slice(1),
}));

export default function ClimbingAnnotation({ activity: a, onSave }: Props) {
  // Free-text buffered locally, saved on blur (not every keystroke).
  const [notes, setNotes] = useState(a.notes ?? "");
  useEffect(() => setNotes(a.notes ?? ""), [a.notes]);
  const [tries, setTries] = useState<number | string>(a.hard_tries ?? "");
  useEffect(() => setTries(a.hard_tries ?? ""), [a.hard_tries]);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" verticalSpacing="md">
        <Input.Wrapper
          label="Type"
          styles={labelStyles}
          error={!a.subtype ? "Pick a type" : undefined}
        >
          <SegmentedControl
            fullWidth
            data={typeData}
            value={a.subtype ?? ""}
            onChange={(v) => onSave({ subtype: v })}
          />
        </Input.Wrapper>
        <Select
          label="Focus"
          placeholder="Training focus"
          data={CLIMBING_FOCUS}
          value={a.focus}
          onChange={(v) => v && onSave({ focus: v })}
          error={!a.focus ? "Pick a focus" : undefined}
          styles={labelStyles}
        />
        <NumberInput
          label="Hard tries"
          placeholder="0"
          min={0}
          allowNegative={false}
          allowDecimal={false}
          value={tries}
          onChange={setTries}
          onBlur={() => {
            const v = typeof tries === "number" ? tries : null;
            if (v !== (a.hard_tries ?? null)) onSave({ hard_tries: v });
          }}
          styles={labelStyles}
        />
      </SimpleGrid>

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
