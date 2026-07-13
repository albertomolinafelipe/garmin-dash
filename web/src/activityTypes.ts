// Presentation-layer taxonomy that abstracts Garmin's many raw activity types into
// a handful of categories, plus optional subtypes. Single source of truth for the
// frontend; when we build the Obsidian export this may move server-side.
import type { ComponentType } from "react";
import {
  IconActivity,
  IconBarbell,
  IconBike,
  IconCloudStorm,
  IconRun,
  IconSnowflake,
  IconSun,
  IconSwimming,
  IconWalk,
} from "@tabler/icons-react";
// Tabler has no good climbing icon; use lorc's boulder (inlined, see RockIcon).
import RockIcon from "./components/RockIcon";
import { kanagawa } from "./theme";
import type { Activity } from "./api/types";

// Heterogeneous icon registry: Tabler and react-icons components have slightly
// different prop types (e.g. stroke), so we accept any icon component here. Call
// sites pass a compatible subset (size / color / stroke).
export type IconComponent = ComponentType<any>;

export type Category =
  | "running"
  | "climbing"
  | "strength"
  | "hiking"
  | "swimming"
  | "cycling"
  | "other";

export const RUNNING_SUBTYPES = ["road", "treadmill", "trail", "mountain"] as const;
export const CLIMBING_SUBTYPES = ["rope", "boulder", "board"] as const;

// Garmin activity_type keys we treat as climbing out of the box. (The user's own
// climbing is often logged as strength_training and reclassified by hand instead.)
const CLIMBING_GARMIN = new Set([
  "rock_climbing",
  "bouldering",
  "indoor_climbing",
  "climbing",
]);

const isClimbingSubtype = (s: string | null): boolean =>
  !!s && (CLIMBING_SUBTYPES as readonly string[]).includes(s);

export function categoryOf(
  activityType: string | null,
  subtype: string | null,
): Category {
  if (isClimbingSubtype(subtype)) return "climbing";
  const at = (activityType ?? "").toLowerCase();
  if (CLIMBING_GARMIN.has(at)) return "climbing";
  if (at.includes("running")) return "running";
  if (at.includes("swimming")) return "swimming";
  if (at.includes("cycling") || at.includes("biking")) return "cycling";
  if (["hiking", "mountaineering", "walking"].includes(at)) return "hiking";
  if (at.includes("strength")) return "strength";
  return "other";
}

// Default running subtype inferred from Garmin's type. "mountain" is manual-only.
function defaultRunningSubtype(activityType: string | null): string | null {
  const at = (activityType ?? "").toLowerCase();
  if (at.includes("trail")) return "trail";
  if (at.includes("treadmill") || at.includes("indoor")) return "treadmill";
  if (at.includes("running")) return "road";
  return null;
}

// The subtype to display: the user's value if set, else a sensible default.
export function effectiveSubtype(
  activityType: string | null,
  subtype: string | null,
): string | null {
  if (subtype) return subtype;
  if (categoryOf(activityType, subtype) === "running") {
    return defaultRunningSubtype(activityType);
  }
  return null;
}

// A subtype the user still has to pick by hand: climbing (rope/boulder/board) or
// trail running (trail vs mountain — road/treadmill are seeded at ingest).
export function needsSubtype(
  activityType: string | null,
  subtype: string | null,
): boolean {
  const at = (activityType ?? "").toLowerCase();
  if (categoryOf(activityType, subtype) === "climbing" && !subtype) return true;
  if (at.includes("trail") && subtype !== "trail" && subtype !== "mountain") return true;
  return false;
}

export const CAFFEINE_OPTIONS = ["no", "residual", "yes"] as const;

// Optional weather annotation (not required for completeness). No "normal" option —
// an empty value means normal.
export const WEATHER_OPTIONS: { value: string; icon: IconComponent; label: string }[] = [
  { value: "cold", icon: IconSnowflake, label: "Exceptionally cold" },
  { value: "hot", icon: IconSun, label: "Hot" },
  { value: "bad", icon: IconCloudStorm, label: "Bad conditions" },
];

// Which terrains are selectable given Garmin's type. Trail runs → trail/mountain;
// treadmill → treadmill; an outdoor road run → any outdoor terrain (not treadmill).
// Returns SegmentedControl data (all four, with the invalid ones disabled).
export function terrainOptions(
  activityType: string | null,
): { value: string; label: string; disabled: boolean }[] {
  const at = (activityType ?? "").toLowerCase();
  let enabled: readonly string[];
  if (at.includes("trail")) enabled = ["trail", "mountain"];
  else if (at.includes("treadmill") || at.includes("indoor")) enabled = ["treadmill"];
  else enabled = ["road", "trail", "mountain"];
  return RUNNING_SUBTYPES.map((s) => ({
    value: s,
    label: s[0].toUpperCase() + s.slice(1),
    disabled: !enabled.includes(s),
  }));
}

// Activities before this date predate the annotation workflow — grandfathered done.
export const ANNOTATED_CUTOFF = "2026-07-13";

// Derived completeness: is any required annotation for this activity's category
// missing? Drives the Overview "needs annotation" panel (no stored flag).
export function needsAnnotation(a: Activity): boolean {
  if (a.start_time && a.start_time.slice(0, 10) < ANNOTATED_CUTOFF) return false;
  const cat = categoryOf(a.activity_type, a.subtype);
  if (cat === "running") {
    // Required: terrain, feel, intensity, caffeine. Food & weather are optional.
    return (
      needsSubtype(a.activity_type, a.subtype) ||
      a.feeling == null ||
      a.effort == null ||
      !a.caffeine
    );
  }
  if (cat === "climbing") return !a.subtype;
  return false;
}

export const categoryIcon: Record<Category, IconComponent> = {
  running: IconRun,
  climbing: RockIcon,
  strength: IconBarbell,
  hiking: IconWalk,
  swimming: IconSwimming,
  cycling: IconBike,
  other: IconActivity,
};

// Muted Kanagawa accent per category (darker tones, not the bright primary blue).
export const categoryColor: Record<Category, string> = {
  running: kanagawa.dragonBlue,
  climbing: kanagawa.autumnYellow,
  strength: kanagawa.autumnRed,
  hiking: kanagawa.autumnGreen,
  swimming: kanagawa.waveAqua2,
  cycling: kanagawa.oniViolet,
  other: kanagawa.fujiGray,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Human label, e.g. "Running · Trail" or "Climbing".
export function typeLabel(
  activityType: string | null,
  subtype: string | null,
): string {
  const cat = categoryOf(activityType, subtype);
  const sub = effectiveSubtype(activityType, subtype);
  return sub ? `${cap(cat)} · ${cap(sub)}` : cap(cat);
}

// Grouped options for a Mantine Select (Running + Climbing subtypes).
export const subtypeSelectData = [
  {
    group: "Running",
    items: RUNNING_SUBTYPES.map((s) => ({ value: s, label: cap(s) })),
  },
  {
    group: "Climbing",
    items: CLIMBING_SUBTYPES.map((s) => ({ value: s, label: cap(s) })),
  },
];
