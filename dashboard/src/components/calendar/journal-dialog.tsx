import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	useDeleteJournalEntryMutation,
	useInsertJournalEntryMutation,
	useJournalKindsQuery,
	useUpdateJournalEntryMutation,
} from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import {
	journalIcon,
	kindOf,
	SEVERITY_LABEL,
	SEVERITY_MAX,
	SEVERITY_MIN,
} from "@/lib/journal";
import type { JournalEntry, JournalKind } from "./model";

// Open on a day to record something new, or on an existing entry to edit it.
export interface JournalTarget {
	day: Date;
	entry?: JournalEntry;
}

const DEFAULT_KIND = "feeling";

export function JournalDialog({
	target,
	onClose,
}: {
	target: JournalTarget | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertJournalEntryMutation();
	const update = useUpdateJournalEntryMutation();
	const remove = useDeleteJournalEntryMutation();
	const { data: kinds } = useJournalKindsQuery() as {
		data: JournalKind[] | undefined;
	};
	const editing = target?.entry;

	const [kind, setKind] = useState(DEFAULT_KIND);
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [title, setTitle] = useState("");
	const [note, setNote] = useState("");
	const [severity, setSeverity] = useState("");

	// Seed the form whenever the dialog opens on a different target. A new entry
	// starts as a single day -- the day that was clicked -- which the range
	// picker can then be dragged out from.
	useEffect(() => {
		if (!target) return;
		const entry = target.entry;
		const day = dayKey(target.day);
		setKind(entry?.kind ?? DEFAULT_KIND);
		setFrom(entry?.start_date ?? day);
		setTo(entry?.end_date ?? (entry ? "" : day));
		setTitle(entry?.title ?? "");
		setNote(entry?.note ?? "");
		setSeverity(entry?.severity ? String(entry.severity) : "");
	}, [target]);

	const selectedKind = kindOf(kinds, kind);
	const KindIcon = journalIcon(selectedKind.icon);
	const busy = insert.isPending || update.isPending || remove.isPending;
	const canSave = Boolean(title.trim()) && Boolean(from) && !busy;

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["journal-entries"] });

	const save = async () => {
		if (!target || !canSave) return;
		const fields = {
			kind,
			start_date: from,
			// An open end is meaningful, not missing: the trip or injury is ongoing.
			end_date: to || null,
			title: title.trim(),
			note: note.trim() || null,
			// Severity is dropped when switching to a kind that doesn't use it, so a
			// stale 4 can't linger invisibly on a trip.
			severity: selectedKind.has_severity && severity ? Number(severity) : null,
		};
		try {
			if (editing) {
				await update.mutateAsync({ id: editing.id, set: fields });
			} else {
				await insert.mutateAsync({ object: fields });
			}
			await invalidate();
			onClose();
		} catch {
			toast.error(
				editing ? "Could not save the entry" : "Could not add the entry",
			);
		}
	};

	const destroy = async () => {
		if (!editing || busy) return;
		try {
			await remove.mutateAsync({ id: editing.id });
			await invalidate();
			onClose();
		} catch {
			toast.error("Could not delete the entry");
		}
	};

	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit entry" : "Add entry"}</DialogTitle>
					<DialogDescription>
						Trips, illness, injuries, or how a stretch of days felt.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label>Kind</Label>
						<Select value={kind} onValueChange={setKind}>
							<SelectTrigger className="w-full">
								<span className="flex items-center gap-2">
									<KindIcon size={16} style={{ color: selectedKind.color }} />
									{selectedKind.label}
								</span>
							</SelectTrigger>
							<SelectContent>
								{(kinds ?? []).map((k) => {
									const Icon = journalIcon(k.icon);
									return (
										<SelectItem key={k.value} value={k.value}>
											<span className="flex items-center gap-2">
												<Icon size={16} style={{ color: k.color }} />
												{k.label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="journal-range">Dates</Label>
						<DateRangePicker
							id="journal-range"
							from={from}
							to={to}
							className="w-full"
							onChange={(range) => {
								setFrom(range.from);
								setTo(range.to);
							}}
						/>
						<p className="text-muted-foreground text-xs">
							{from && !to
								? "No end date — treated as still ongoing."
								: "Pick one day, or drag to cover a range. Leave the end open if it is still ongoing."}
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="journal-title">Title</Label>
						<Input
							id="journal-title"
							autoFocus
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Chamonix, head cold, left ankle…"
						/>
					</div>

					{selectedKind.has_severity ? (
						<div className="flex flex-col gap-2">
							<Label>Severity</Label>
							<ToggleGroup
								type="single"
								variant="outline"
								value={severity}
								onValueChange={setSeverity}
							>
								{Array.from(
									{ length: SEVERITY_MAX - SEVERITY_MIN + 1 },
									(_, i) => String(i + SEVERITY_MIN),
								).map((value) => (
									<ToggleGroupItem
										key={value}
										value={value}
										aria-label={SEVERITY_LABEL[Number(value)]}
										title={SEVERITY_LABEL[Number(value)]}
									>
										{value}
									</ToggleGroupItem>
								))}
							</ToggleGroup>
							<p className="text-muted-foreground text-xs">
								{severity
									? SEVERITY_LABEL[Number(severity)]
									: "Optional — 1 is barely noticeable, 5 is severe."}
							</p>
						</div>
					) : null}

					<div className="flex flex-col gap-2">
						<Label htmlFor="journal-note">Note</Label>
						<Textarea
							id="journal-note"
							rows={3}
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Anything worth remembering when looking back at this stretch"
						/>
					</div>
				</div>

				<DialogFooter>
					{editing ? (
						<Button
							variant="ghost"
							className="text-destructive sm:mr-auto"
							disabled={busy}
							onClick={() => void destroy()}
						>
							Delete
						</Button>
					) : null}
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={!canSave} onClick={() => void save()}>
						{busy ? "Saving…" : editing ? "Save" : "Add entry"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
