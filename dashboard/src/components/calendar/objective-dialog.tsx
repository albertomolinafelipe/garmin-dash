import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
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
import {
	useDeleteWeekObjectiveMutation,
	useInsertWeekObjectiveMutation,
	useSportsQuery,
	useUpdateWeekObjectiveMutation,
} from "@/graphql/hooks";
import type { WeekObjective } from "./model";
import {
	ALL_SPORTS,
	type Metric,
	METRIC_META,
	METRICS,
	sportIcon,
} from "@/lib/plans";

// Open on a week to add an objective, or on an existing one to edit it.
export interface ObjectiveTarget {
	week: string;
	objective?: WeekObjective;
}

// A measurable weekly target. ALL_SPORTS stores NULL, meaning the objective
// spans every sport.
export function ObjectiveDialog({
	target: dialogTarget,
	onClose,
}: {
	target: ObjectiveTarget | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertWeekObjectiveMutation();
	const update = useUpdateWeekObjectiveMutation();
	const remove = useDeleteWeekObjectiveMutation();
	const { data: sports } = useSportsQuery();
	const editing = dialogTarget?.objective;
	const [sport, setSport] = useState(ALL_SPORTS);
	const [metric, setMetric] = useState<string>(METRICS[0]);
	const [target, setTarget] = useState<number | null>(null);
	const meta = METRIC_META[metric as Metric];
	const SportIcon = sportIcon(sport === ALL_SPORTS ? null : sport);
	const sportLabel =
		sports?.find((s) => s.value === sport)?.label ?? "All sports";
	const busy = insert.isPending || update.isPending || remove.isPending;
	const saveLabel = editing ? "Save" : "Add objective";

	// Seed the form whenever the dialog opens on a different target. Stored targets
	// are in base units, so convert back to the unit the form edits in.
	useEffect(() => {
		if (!dialogTarget) return;
		const o = dialogTarget.objective;
		setSport(o?.sport ?? ALL_SPORTS);
		setMetric(o?.metric ?? METRICS[0]);
		setTarget(
			o ? METRIC_META[o.metric as Metric].fromBase(Number(o.target)) : null,
		);
	}, [dialogTarget]);

	const save = async () => {
		if (!dialogTarget || target === null || busy) return;
		const fields = {
			sport: sport === ALL_SPORTS ? null : sport,
			metric,
			target: meta.toBase(target),
		};
		try {
			if (editing) {
				await update.mutateAsync({ id: editing.id, set: fields });
			} else {
				await insert.mutateAsync({
					object: { week: dialogTarget.week, ...fields },
				});
			}
			await queryClient.invalidateQueries({ queryKey: ["week-objectives"] });
			onClose();
		} catch {
			toast.error("Could not save the objective");
		}
	};

	const destroy = async () => {
		if (!editing || busy) return;
		try {
			await remove.mutateAsync({ id: editing.id });
			await queryClient.invalidateQueries({ queryKey: ["week-objectives"] });
			onClose();
		} catch {
			toast.error("Could not delete the objective");
		}
	};

	return (
		<Dialog
			open={dialogTarget !== null}
			onOpenChange={(open) => !open && onClose()}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{editing ? "Edit objective" : "Add objective"}
					</DialogTitle>
					<DialogDescription>
						{dialogTarget
							? `Weekly target for ${dialogTarget.week}`
							: "Select a week"}
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
								<SelectItem value={ALL_SPORTS}>
									<span className="flex items-center gap-2">
										<SportIcon className="size-4" />
										All sports
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
						<Label>Metric</Label>
						<Select value={metric} onValueChange={setMetric}>
							<SelectTrigger className="w-full">
								<span className="flex items-center gap-2">
									<meta.icon className="size-4" />
									{meta.label}
								</span>
							</SelectTrigger>
							<SelectContent>
								{METRICS.map((value) => {
									const Icon = METRIC_META[value].icon;
									return (
										<SelectItem key={value} value={value}>
											<span className="flex items-center gap-2">
												<Icon className="size-4" />
												{METRIC_META[value].label}
											</span>
										</SelectItem>
									);
								})}
							</SelectContent>
						</Select>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="objective-target">Target</Label>
						<div className="relative">
							<NumberInput
								id="objective-target"
								nonNegative
								value={target}
								placeholder="0"
								className="pr-10"
								onChange={setTarget}
								onKeyDown={(event) => {
									if (event.key === "Enter") void save();
								}}
							/>
							{meta.inputUnit ? (
								<span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs">
									{meta.inputUnit}
								</span>
							) : null}
						</div>
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
					<Button
						disabled={target === null || busy}
						onClick={() => void save()}
					>
						{busy ? "Saving…" : saveLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
