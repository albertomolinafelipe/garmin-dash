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
	IconSettings,
} from "@tabler/icons-react";
import { Link, Route, Routes, useLocation } from "react-router-dom";

import { api } from "./api/client";
import { queryClient } from "./queryClient";
import AnnotationBell from "./components/AnnotationBell";
import OverviewPage from "./pages/OverviewPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import CalendarPage from "./pages/CalendarPage";
import SleepPage from "./pages/SleepPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
	const [opened, { toggle }] = useDisclosure();
	const location = useLocation();

	const sync = useMutation({
		mutationFn: (v: {
			label: string;
			params: {
				days?: number;
				download_fits?: boolean;
				max_activities?: number;
			};
		}) => api.sync(v.params),
		onSuccess: (r) => {
			const fits = r.fits_downloaded ? `, FIT +${r.fits_downloaded}` : "";
			const missing = r.fits_missing
				? ` — ${r.fits_missing} FIT missing, re-run to retry`
				: "";
			const failed = r.errors?.length
				? ` — ${r.errors.length} API error(s): ${r.errors[0]}`
				: "";
			notifications.show({
				title: r.errors?.length ? "Sync stopped early" : "Sync complete",
				message: `Activities +${r.activities_created}/~${r.activities_updated}${fits}, Sleep +${r.sleep_created}/~${r.sleep_updated}${missing}${failed}`,
				color: r.errors?.length ? "red" : r.fits_missing ? "yellow" : "green",
				autoClose: r.errors?.length ? false : undefined,
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

	// Backfill: full history WITH .fit files, sleep capped at 2y. Idempotent +
	// resumable — re-run to retry any FIT downloads Garmin throttled.
	const backfill = () => {
		if (
			!window.confirm(
				"Backfill your full Garmin history? This pulls every activity (with FIT " +
					"files) and up to 2 years of sleep — it can take a while. Safe to re-run.",
			)
		)
			return;
		sync.mutate({
			label: "backfill",
			params: { days: 730, max_activities: 0, download_fits: true },
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
						<Burger
							opened={opened}
							onClick={toggle}
							hiddenFrom="sm"
							size="sm"
						/>
						<Title order={4}>garmin-dash</Title>
					</Group>
					<Group gap="xs">
						<AnnotationBell />
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
				<NavLink
					component={Link}
					to="/settings"
					label="Settings"
					leftSection={<IconSettings size={18} />}
					active={location.pathname.startsWith("/settings")}
				/>
			</AppShell.Navbar>

			<AppShell.Main>
				<Routes>
					<Route path="/" element={<OverviewPage />} />
					<Route path="/activities" element={<ActivitiesPage />} />
					<Route path="/activities/:id" element={<ActivityDetailPage />} />
					<Route path="/calendar" element={<CalendarPage />} />
					<Route path="/sleep" element={<SleepPage />} />
					<Route path="/settings" element={<SettingsPage />} />
				</Routes>
			</AppShell.Main>
		</AppShell>
	);
}
