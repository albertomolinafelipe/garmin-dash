import { dayKey } from "@/lib/format";
import {
	entryTooltip,
	journalIcon,
	kindOf,
	SEVERITY_MAX,
} from "@/lib/journal";
import { cn } from "@/lib/utils";
import type { JournalEntry, JournalKind } from "./model";

// Severity as filled pips, so a bad week reads at a glance without taking the
// room a number and label would. Hidden on narrow cells, where the chip is
// already down to just its icon.
function SeverityPips({ value, color }: { value: number; color: string }) {
	return (
		<span
			className="hidden shrink-0 items-center gap-px md:inline-flex"
			aria-hidden="true"
		>
			{Array.from({ length: SEVERITY_MAX }, (_, i) => (
				<span
					key={i}
					className="size-1 rounded-full"
					style={{
						backgroundColor: i < value ? color : "currentColor",
						opacity: i < value ? 0.9 : 0.2,
					}}
				/>
			))}
		</span>
	);
}

function JournalChip({
	entry,
	kind,
	isContinuation,
	onEdit,
}: {
	entry: JournalEntry;
	kind: JournalKind;
	isContinuation: boolean;
	onEdit: (entry: JournalEntry) => void;
}) {
	const Icon = journalIcon(kind.icon);
	return (
		<button
			type="button"
			onClick={() => onEdit(entry)}
			title={entryTooltip(entry, kind)}
			aria-label={`${kind.label}: ${entry.title}`}
			className={cn(
				"flex w-full min-w-0 items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1 text-left leading-tight transition-colors",
				"hover:bg-accent",
			)}
			style={{
				borderLeftColor: kind.color,
				// A span's middle days are tinted more faintly than its first, so a
				// fortnight of trip chips doesn't shout over the activities in the
				// same cells, while the start of the span still stands out.
				backgroundColor: `color-mix(in oklab, ${kind.color} ${
					isContinuation ? 8 : 16
				}%, transparent)`,
			}}
		>
			<Icon size={13} className="shrink-0" style={{ color: kind.color }} />
			<span className="hidden min-w-0 flex-1 truncate text-xs font-medium md:inline">
				{entry.title}
			</span>
			{entry.severity ? (
				<SeverityPips value={entry.severity} color={kind.color} />
			) : null}
		</button>
	);
}

// Journal entries covering this day, drawn above the day's activities so they
// read as context for what follows. Multi-day entries repeat their chip on
// every day they cover, which survives week wrapping and month boundaries for
// free -- a spanning bar would have to be re-clipped at each.
export function DayJournal({
	day,
	byDay,
	kinds,
	onEdit,
}: {
	day: Date;
	byDay: Map<string, JournalEntry[]>;
	kinds: JournalKind[] | undefined;
	onEdit: (entry: JournalEntry) => void;
}) {
	const key = dayKey(day);
	const entries = byDay.get(key) ?? [];
	if (entries.length === 0) return null;

	// Stable order across the days of a span: by kind, then by start date, so a
	// chip doesn't jump rows as other entries begin and end around it.
	const rank = (value: string) => {
		const i = kinds?.findIndex((k) => k.value === value) ?? -1;
		return i < 0 ? Number.MAX_SAFE_INTEGER : i;
	};
	const ordered = [...entries].sort(
		(a, b) =>
			rank(a.kind) - rank(b.kind) ||
			a.start_date.localeCompare(b.start_date) ||
			String(a.id).localeCompare(String(b.id)),
	);

	return (
		<div className="flex flex-col gap-0.5 pb-1">
			{ordered.map((entry) => (
				<JournalChip
					key={String(entry.id)}
					entry={entry}
					kind={kindOf(kinds, entry.kind)}
					isContinuation={entry.start_date !== key}
					onEdit={onEdit}
				/>
			))}
		</div>
	);
}
