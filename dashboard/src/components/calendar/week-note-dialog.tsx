import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
	useDeleteWeekNoteMutation,
	useUpsertWeekNoteMutation,
} from "@/graphql/hooks";

// One free-text note per ISO week, e.g. "recovery, focus on low intensity".
// Saving an emptied note deletes the row rather than storing a blank one.
export function WeekNoteDialog({
	week,
	note,
	onClose,
}: {
	week: string | null;
	note?: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const upsert = useUpsertWeekNoteMutation();
	const remove = useDeleteWeekNoteMutation();
	const [draft, setDraft] = useState("");

	useEffect(() => {
		if (week) setDraft(note ?? "");
	}, [week, note]);

	const busy = upsert.isPending || remove.isPending;
	const existed = Boolean(note);

	const save = async () => {
		if (!week || busy) return;
		const text = draft.trim();
		if (!text && !existed) {
			onClose();
			return;
		}
		try {
			if (text) {
				await upsert.mutateAsync({ object: { week, note: text } });
			} else {
				await remove.mutateAsync({ week });
			}
			await queryClient.invalidateQueries({ queryKey: ["week-notes"] });
			onClose();
		} catch {
			toast.error("Could not save the week note");
		}
	};

	return (
		<Dialog open={week !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Week note</DialogTitle>
					<DialogDescription>
						{week ? `Focus for ${week}` : "Select a week"}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="week-note">Note</Label>
					<Textarea
						id="week-note"
						autoFocus
						rows={5}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Recovery week — focus on low intensity effort"
					/>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={busy} onClick={() => void save()}>
						{busy ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
