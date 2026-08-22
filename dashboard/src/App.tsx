import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { nhost } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { Activities } from "@/pages/Activities";
import { ActivityDetail } from "@/pages/ActivityDetail";
import { Calendar } from "@/pages/Calendar";
import { Overview } from "@/pages/Overview";
import { Plans } from "@/pages/Plans";
import { Settings } from "@/pages/Settings";
import { queryClient } from "@/queryClient";

export default function App() {
	const [session, setSession] = useState(() => nhost.getUserSession());
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const unsubscribe = nhost.sessionStorage.onChange(setSession);
		nhost
			.refreshSession()
			.then(setSession)
			.catch(() => {
				nhost.clearSession();
				setSession(null);
			})
			.finally(() => setReady(true));
		return unsubscribe;
	}, []);

	async function signOut() {
		try {
			await nhost.auth.signOut({ refreshToken: session?.refreshToken });
		} finally {
			nhost.clearSession();
			queryClient.clear();
			setSession(null);
		}
	}

	if (!ready) return null;

	return (
		<AppShell authenticated={session !== null} onSignOut={signOut}>
			<Routes>
				<Route path="/" element={<Navigate to="/overview" replace />} />
				<Route path="/overview" element={<Overview />} />
				<Route path="/calendar" element={<Calendar />} />
				<Route path="/activities" element={<Activities />} />
				<Route path="/activities/:id" element={<ActivityDetail />} />
				<Route path="/plans" element={<Plans />} />
				<Route path="/settings" element={<Settings />} />
				<Route path="*" element={<Navigate to="/overview" replace />} />
			</Routes>
		</AppShell>
	);
}
