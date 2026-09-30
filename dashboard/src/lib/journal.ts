import type { JournalEntry, JournalKind } from "@/components/calendar/model";
import { iconifyIcon, type IconComponent } from "./activity-types";

// Kinds are DB rows, so their icons are names resolved at runtime rather than a
// static map. iconifyIcon() mints a new component type per call, and a fresh
// component type on every render would remount the icon and lose its fade-in,
// so resolved icons are cached by name for the life of the page.
const iconCache = new Map<string, IconComponent>();

export function journalIcon(name: string | undefined): IconComponent {
	const key = name && name.trim() !== "" ? name : FALLBACK_KIND.icon;
	let icon = iconCache.get(key);
	if (!icon) {
		icon = iconifyIcon(key);
		iconCache.set(key, icon);
	}
	return icon;
}

// Used when an entry references a kind the client hasn't loaded -- a row added
// to journal_kinds while the tab was open, most likely. Renders neutrally
// instead of throwing away the entry.
export const FALLBACK_KIND: JournalKind = {
	value: "note",
	label: "Note",
	icon: "mdi:note-text-outline",
	color: "var(--muted-foreground)",
	has_severity: false,
};

export function kindOf(
	kinds: JournalKind[] | undefined,
	value: string,
): JournalKind {
	return kinds?.find((k) => k.value === value) ?? FALLBACK_KIND;
}

// 1 (mild) to 5 (severe). Labels keep the scale legible in the form; the
// calendar only ever shows the number of filled dots.
export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 5;
export const SEVERITY_LABEL: Record<number, string> = {
	1: "Barely noticeable",
	2: "Mild",
	3: "Moderate",
	4: "Bad",
	5: "Severe",
};

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

function parseDayKey(key: string): Date | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	if (!m) return null;
	return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Human range for a dialog header or chip tooltip: "Sep 3", "Sep 3 – Sep 14",
// or "Since Sep 3" while an entry is still open.
export function formatRange(entry: JournalEntry): string {
	const start = parseDayKey(entry.start_date);
	if (!start) return entry.start_date;
	const from = start.toLocaleDateString(undefined, MONTH_DAY);
	if (!entry.end_date) return `Since ${from}`;
	if (entry.end_date === entry.start_date) return from;
	const end = parseDayKey(entry.end_date);
	if (!end) return from;
	return `${from} – ${end.toLocaleDateString(undefined, MONTH_DAY)}`;
}

// Inclusive day count, or null while the entry is still open.
export function entryLengthDays(entry: JournalEntry): number | null {
	if (!entry.end_date) return null;
	const start = parseDayKey(entry.start_date);
	const end = parseDayKey(entry.end_date);
	if (!start || !end) return null;
	return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// Tooltip text for a chip: title, range, length, severity and the long note.
export function entryTooltip(entry: JournalEntry, kind: JournalKind): string {
	const days = entryLengthDays(entry);
	const parts = [
		`${kind.label}: ${entry.title}`,
		formatRange(entry) + (days && days > 1 ? ` (${days} days)` : ""),
	];
	if (entry.severity) {
		parts.push(
			`Severity ${entry.severity}/${SEVERITY_MAX}` +
				(SEVERITY_LABEL[entry.severity]
					? ` – ${SEVERITY_LABEL[entry.severity]}`
					: ""),
		);
	}
	if (entry.note) parts.push(entry.note);
	return parts.join("\n");
}
