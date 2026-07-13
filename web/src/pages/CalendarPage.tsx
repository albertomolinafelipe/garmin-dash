import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  dayjsLocalizer,
  type Event,
  type EventProps,
} from "react-big-calendar";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import { ActionIcon, Center, Group, Loader, Stack, Text } from "@mantine/core";
import {
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { Activity } from "../api/types";
import {
  categoryColor,
  categoryIcon,
  categoryOf,
  effectiveSubtype,
  type IconComponent,
} from "../activityTypes";
import { fmtDistance, fmtDuration } from "../format";

// Start weeks on Monday (affects the calendar grid + our week aggregation).
dayjs.extend(updateLocale);
dayjs.updateLocale("en", { weekStart: 1 });

const localizer = dayjsLocalizer(dayjs);

interface ActivityEvent extends Event {
  id: number;
  resource: Activity;
}

interface WeekTotals {
  runKm: number;
  runVert: number;
  runH: number;
  climbH: number;
  weightsH: number;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Secondary line for an event chip: subtype · distance · duration (whatever exists).
function eventInfo(a: Activity): string {
  const parts: string[] = [];
  const sub = effectiveSubtype(a.activity_type, a.subtype);
  if (sub) parts.push(cap(sub));
  if (a.distance_m) parts.push(fmtDistance(a.distance_m));
  if (a.duration_s) parts.push(fmtDuration(a.duration_s));
  return parts.join(" · ");
}

// Event chip: colored category icon + name, then a details line.
function CalendarEvent({ event }: EventProps<ActivityEvent>) {
  const a = event.resource;
  const cat = categoryOf(a.activity_type, a.subtype);
  const Icon = categoryIcon[cat];
  return (
    <div style={{ lineHeight: 1.25 }}>
      <Group gap={4} wrap="nowrap">
        <Icon size={13} stroke={2} color={categoryColor[cat]} />
        <Text size="xs" fw={600} truncate>
          {event.title}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" truncate>
        {eventInfo(a)}
      </Text>
    </div>
  );
}

// The weeks react-big-calendar shows for the month containing `date` (Sun-start,
// matching the dayjs localizer), so the totals column lines up row-for-row.
function weeksForMonth(date: Date): dayjs.Dayjs[] {
  const start = dayjs(date).startOf("month").startOf("week");
  const end = dayjs(date).endOf("month").endOf("week");
  const weeks: dayjs.Dayjs[] = [];
  for (let w = start; w.isBefore(end); w = w.add(1, "week")) weeks.push(w);
  return weeks;
}

function weekTotals(activities: Activity[]): Map<string, WeekTotals> {
  const map = new Map<string, WeekTotals>();

  for (const a of activities) {
    if (!a.start_time) continue;
    const key = dayjs(a.start_time).startOf("week").format("YYYY-MM-DD");
    let t = map.get(key);
    if (!t) {
      t = { runKm: 0, runVert: 0, runH: 0, climbH: 0, weightsH: 0 };
      map.set(key, t);
    }
    const hours = (a.duration_s ?? 0) / 3600;
    switch (categoryOf(a.activity_type, a.subtype)) {
      case "running":
        t.runKm += (a.distance_m ?? 0) / 1000;
        t.runVert += a.elevation_gain_m ?? 0;
        t.runH += hours;
        break;
      case "climbing":
        t.climbH += hours;
        break;
      case "strength":
        t.weightsH += hours;
        break;
    }
  }
  return map;
}

// One metric row in the totals column; dims to nothing when the value is zero.
function TotalRow({
  icon: Icon,
  color,
  value,
  zero,
  indent,
}: {
  icon?: IconComponent;
  color?: string;
  value: string;
  zero: boolean;
  indent?: boolean;
}) {
  return (
    <Group gap={5} wrap="nowrap" pl={indent ? 18 : 0}>
      {Icon && <Icon size={13} stroke={1.8} color={zero ? undefined : color} />}
      <Text size="xs" c={zero ? "dimmed" : undefined} fw={Icon ? 600 : 400}>
        {value}
      </Text>
    </Group>
  );
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["activities", "calendar"],
    queryFn: () => api.listActivities({ limit: 500 }),
  });

  const events = useMemo<ActivityEvent[]>(
    () =>
      (data ?? [])
        .filter((a) => a.start_time)
        .map((a) => {
          const start = new Date(a.start_time!);
          const end = a.duration_s
            ? new Date(start.getTime() + a.duration_s * 1000)
            : start;
          return {
            id: a.id,
            title: a.name ?? a.activity_type ?? "Activity",
            start,
            end,
            resource: a,
          };
        }),
    [data],
  );

  const totals = useMemo(() => weekTotals(data ?? []), [data]);
  const weeks = useMemo(() => weeksForMonth(date), [date]);

  if (isLoading)
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );

  return (
    <div style={{ height: "calc(100vh - 88px)", display: "flex", flexDirection: "column" }}>
      {/* Icon toolbar (controlled month navigation) */}
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ActionIcon variant="default" size="lg" aria-label="Today" onClick={() => setDate(new Date())}>
            <IconCalendarEvent size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Previous month"
            onClick={() => setDate(dayjs(date).subtract(1, "month").toDate())}
          >
            <IconChevronLeft size={18} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Next month"
            onClick={() => setDate(dayjs(date).add(1, "month").toDate())}
          >
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>
        <Text fw={600}>{dayjs(date).format("MMMM YYYY")}</Text>
        <div style={{ width: 108 }} />
      </Group>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Calendar<ActivityEvent>
            localizer={localizer}
            events={events}
            views={["month"]}
            defaultView="month"
            date={date}
            onNavigate={setDate}
            toolbar={false}
            popup
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={(e) => navigate(`/activities/${e.id}`)}
            components={{ event: CalendarEvent }}
            eventPropGetter={(event) => ({
              style: {
                borderLeft: `3px solid ${categoryColor[categoryOf(event.resource.activity_type, event.resource.subtype)]}`,
              },
            })}
            style={{ height: "100%" }}
          />
        </div>

        {/* Week totals — one cell per week row, aligned to the grid */}
        <div className="week-col">
          <div className="week-col-header">Week totals</div>
          {weeks.map((w) => {
            const t = totals.get(w.format("YYYY-MM-DD"));
            return (
              <div className="week-col-cell" key={w.format("YYYY-MM-DD")}>
                <Stack gap={3}>
                  <TotalRow
                    icon={categoryIcon.running}
                    color={categoryColor.running}
                    value={`${(t?.runKm ?? 0).toFixed(1)} km`}
                    zero={!t?.runKm}
                  />
                  <TotalRow
                    value={`${Math.round(t?.runVert ?? 0)} m · ${(t?.runH ?? 0).toFixed(1)} h`}
                    zero={!t?.runH}
                    indent
                  />
                  <TotalRow
                    icon={categoryIcon.climbing}
                    color={categoryColor.climbing}
                    value={`${(t?.climbH ?? 0).toFixed(1)} h`}
                    zero={!t?.climbH}
                  />
                  <TotalRow
                    icon={categoryIcon.strength}
                    color={categoryColor.strength}
                    value={`${(t?.weightsH ?? 0).toFixed(1)} h`}
                    zero={!t?.weightsH}
                  />
                </Stack>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
