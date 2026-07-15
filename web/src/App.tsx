import { AppShell, Burger, Group, NavLink, Title, Button } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  IconActivity,
  IconBed,
  IconCalendar,
  IconHistory,
  IconLayoutDashboard,
  IconRefresh,
} from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";

import { api } from "./api/client";
import { queryClient } from "./queryClient";
import OverviewPage from "./pages/OverviewPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import CalendarPage from "./pages/CalendarPage";
import SleepPage from "./pages/SleepPage";

export default function App() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();

  const sync = useMutation({
    mutationFn: (v: {
      label: string;
      params: { days?: number; download_fits?: boolean; max_activities?: number };
    }) => api.sync(v.params),
    onSuccess: (r) => {
      notifications.show({
        title: "Sync complete",
        message: `Activities +${r.activities_created}/~${r.activities_updated}, Sleep +${r.sleep_created}/~${r.sleep_updated}`,
        color: "green",
      });
      queryClient.invalidateQueries();
    },
    onError: (e: any) =>
      notifications.show({
        title: "Sync failed",
        message: e?.response?.data?.detail ?? String(e),
        color: "red",
      }),
  });

  // Which button triggered the in-flight sync (so only it shows the spinner).
  const running = sync.isPending ? sync.variables?.label : null;

  // Recent: fast everyday pull — last couple weeks, with .fit downloads.
  const syncRecent = () =>
    sync.mutate({
      label: "recent",
      params: { days: 14, max_activities: 30, download_fits: true },
    });

  // Backfill: full history, summaries only (no .fit) for speed, sleep capped at 2y.
  const backfill = () => {
    if (
      !window.confirm(
        "Backfill your full Garmin history? This pulls every activity (summaries " +
          "only) and up to 2 years of sleep — it can take a few minutes.",
      )
    )
      return;
    sync.mutate({
      label: "backfill",
      params: { days: 730, max_activities: 0, download_fits: false },
    });
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>garmin-dash</Title>
          </Group>
          <Group gap="xs">
            <Button
              leftSection={<IconHistory size={16} />}
              loading={running === "backfill"}
              disabled={sync.isPending && running !== "backfill"}
              onClick={backfill}
              variant="default"
            >
              Backfill
            </Button>
            <Button
              leftSection={<IconRefresh size={16} />}
              loading={running === "recent"}
              disabled={sync.isPending && running !== "recent"}
              onClick={syncRecent}
              variant="light"
            >
              Sync
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <NavLink
          component={Link}
          to="/"
          label="Overview"
          leftSection={<IconLayoutDashboard size={18} />}
          active={location.pathname === "/"}
        />
        <NavLink
          component={Link}
          to="/calendar"
          label="Calendar"
          leftSection={<IconCalendar size={18} />}
          active={location.pathname.startsWith("/calendar")}
        />
        <NavLink
          component={Link}
          to="/activities"
          label="List"
          leftSection={<IconActivity size={18} />}
          active={location.pathname.startsWith("/activities")}
        />
        <NavLink
          component={Link}
          to="/sleep"
          label="Sleep"
          leftSection={<IconBed size={18} />}
          active={location.pathname.startsWith("/sleep")}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/activities/:id" element={<ActivityDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/sleep" element={<SleepPage />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
}
