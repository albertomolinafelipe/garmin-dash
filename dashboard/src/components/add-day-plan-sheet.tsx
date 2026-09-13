import { useState } from "react";
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
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useInsertDayPlanMutation, useSportsQuery } from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import { ANY_SPORT, sportIcon } from "@/lib/plans";

// Adds a free-text intention to `day`. Sport is optional: ANY_SPORT stores NULL.
export function AddDayPlanSheet({
	day,
	onClose,
}: {
	day: Date | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertDayPlanMutation();
	const { data: sports } = useSportsQuery();
	const [sport, setSport] = useState<string>(ANY_SPORT);
	const [note, setNote] = useState("");
	const SportIcon = sportIcon(sport === ANY_SPORT ? null : sport);
	const sportLabel =
		sports?.find((s) => s.value === sport)?.label ?? "Any sport";

	const resetAndClose = () => {
		setSport(ANY_SPORT);
		setNote("");
		onClose();
	};

	const save = async () => {
		if (!day || !note.trim() || insert.isPending) return;
		try {
			await insert.mutateAsync({
				object: {
					date: dayKey(day),
					sport: sport === ANY_SPORT ? null : sport,
					note: note.trim(),
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
			resetAndClose();
		} catch {
			toast.error("Could not add plan");
		}
	};

	return (
		<Sheet open={day !== null} onOpenChange={(open) => !open && resetAndClose()}>
			<SheetContent side="right" className="gap-5 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Add plan</SheetTitle>
					<SheetDescription>
						{day
							? day.toLocaleDateString(undefined, {
									weekday: "long",
									month: "long",
									day: "numeric",
								})
							: "Select a calendar day"}
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-4 px-4">
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
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Easy run, 45 min zone 2"
						/>
					</div>
				</div>
				<SheetFooter>
					<Button
						disabled={!note.trim() || insert.isPending}
						onClick={() => void save()}
					>
						{insert.isPending ? "Saving…" : "Add plan"}
					</Button>
					<Button variant="ghost" onClick={resetAndClose}>
						Cancel
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
