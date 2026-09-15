// Sleep-stage colours, shared by the overview sleep chart and the activity-page
// donut. Blue for asleep (dark deep, lighter light), fuchsia for the rest (dark
// REM, light awake) — muted to sit with the Kanagawa theme.
export const SLEEP_STAGE_COLORS = {
	deep: "#2D4F67",
	light: "#7E9CD8",
	rem: "#A24E86",
	awake: "#D9A6CE",
} as const;
