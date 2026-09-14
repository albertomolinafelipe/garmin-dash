import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/components/ui/select";
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
	useDeleteDayPlanMutation,
	useInsertDayPlanMutation,
	useSportsQuery,
	useUpdateDayPlanMutation,
} from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import { ANY_SPORT, sportIcon } from "@/lib/plans";
import type { DayPlan } from "./model";

// Open on a day to add a plan, or on an existing plan to edit it. `plan` is the
// row being edited; `day` alone means a fresh one.
export interface DayPlanTarget {
	day: Date;
	plan?: DayPlan;
}

export function DayPlanDialog({
	target,
	onClose,
}: {
	target: DayPlanTarget | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertDayPlanMutation();
	const update = useUpdateDayPlanMutation();
	const remove = useDeleteDayPlanMutation();
	const { data: sports } = useSportsQuery();
	const editing = target?.plan;
	const [sport, setSport] = useState(ANY_SPORT);
	const [note, setNote] = useState("");

	// Seed the form whenever the dialog opens on a different target.
	useEffect(() => {
		if (!target) return;
		setSport(target.plan?.sport ?? ANY_SPORT);
		setNote(target.plan?.note ?? "");
	}, [target]);

	const SportIcon = sportIcon(sport === ANY_SPORT ? null : sport);
	const sportLabel =
		sports?.find((s) => s.value === sport)?.label ?? "Any sport";
	const busy = insert.isPending || update.isPending || remove.isPending;
	const saveLabel = editing ? "Save" : "Add plan";

	const save = async () => {
		if (!target || !note.trim() || busy) return;
		const fields = {
			sport: sport === ANY_SPORT ? null : sport,
			note: note.trim(),
		};
		try {
			if (editing) {
				await update.mutateAsync({ id: editing.id, set: fields });
			} else {
				await insert.mutateAsync({
					object: { date: dayKey(target.day), ...fields },
				});
			}
			await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
			onClose();
		} catch {
			toast.error(editing ? "Could not save the plan" : "Could not add plan");
		}
	};

	const destroy = async () => {
		if (!editing || busy) return;
		try {
			await remove.mutateAsync({ id: editing.id });
			await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
			onClose();
		} catch {
			toast.error("Could not delete the plan");
		}
	};

	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{editing ? "Edit plan" : "Add plan"}</DialogTitle>
					<DialogDescription>
						{target
							? target.day.toLocaleDateString(undefined, {
									weekday: "long",
									month: "long",
									day: "numeric",
								})
							: "Select a calendar day"}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label>Sport</Label>
						<Select value={sport} onValueChange={setSport}>
							<SelectTrigger className="w-full">
								<span className="flex items-center gap-2">
									<SportIcon className="size-4" />
									{sportLabel}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ANY_SPORT}>
									<span className="flex items-center gap-2">
										<SportIcon className="size-4" />
										Any sport
									</span>
								</SelectItem>
								{(sports ?? []).map((s) => {
									const Icon = sportIcon(s.value);
									return (
										<SelectItem key={s.value} value={s.value}>
											<span className="flex items-center gap-2">
												<Icon className="size-4" />
												{s.label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="day-plan-note">Note</Label>
						<Textarea
							id="day-plan-note"
							autoFocus
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Easy run, 45 min zone 2"
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
					<Button disabled={!note.trim() || busy} onClick={() => void save()}>
						{busy ? "Saving…" : saveLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
