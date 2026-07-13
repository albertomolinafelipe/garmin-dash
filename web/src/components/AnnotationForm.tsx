import { useEffect, useState } from "react";
import {
  Button,
  Group,
  NumberInput,
  Rating,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import type { Annotation } from "../api/types";

interface Props {
  initial: Annotation;
  onSave: (values: Annotation) => void;
  saving?: boolean;
}

// Editor for the user-owned fields. These are the fields that will map to the
// future Obsidian markdown frontmatter — keep this in sync with the DB model.
export default function AnnotationForm({ initial, onSave, saving }: Props) {
  const [feeling, setFeeling] = useState(initial.feeling ?? "");
  const [rpe, setRpe] = useState<number>(initial.rpe ?? 0);
  const [mood, setMood] = useState(initial.mood ?? "");
  const [tags, setTags] = useState(initial.tags ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  // Re-seed when navigating between records.
  useEffect(() => {
    setFeeling(initial.feeling ?? "");
    setRpe(initial.rpe ?? 0);
    setMood(initial.mood ?? "");
    setTags(initial.tags ?? "");
    setNotes(initial.notes ?? "");
  }, [initial]);

  return (
    <Stack>
      <TextInput
        label="Feeling"
        placeholder="e.g. strong, tired, flat"
        value={feeling}
        onChange={(e) => setFeeling(e.currentTarget.value)}
      />
      <div>
        <Text size="sm" fw={500} mb={4}>
          RPE (perceived exertion)
        </Text>
        <Group>
          <Rating value={rpe} onChange={setRpe} count={10} />
          <NumberInput
            value={rpe}
            onChange={(v) => setRpe(Number(v) || 0)}
            min={0}
            max={10}
            w={80}
          />
        </Group>
      </div>
      <TextInput
        label="Mood"
        placeholder="e.g. happy, stressed"
        value={mood}
        onChange={(e) => setMood(e.currentTarget.value)}
      />
      <TextInput
        label="Tags"
        placeholder="comma,separated,tags"
        value={tags}
        onChange={(e) => setTags(e.currentTarget.value)}
      />
      <Textarea
        label="Notes"
        placeholder="Markdown notes — becomes the Obsidian note body later"
        autosize
        minRows={4}
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button
          loading={saving}
          onClick={() =>
            onSave({
              feeling,
              rpe: rpe || null,
              mood,
              tags,
              notes,
            })
          }
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
}
