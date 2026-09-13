import { useState } from "react";
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
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	useInsertWeekObjectiveMutation,
	useSportsQuery,
} from "@/graphql/hooks";
import {
	ALL_SPORTS,
	type Metric,
	METRIC_META,
	METRICS,
	sportIcon,
} from "@/lib/plans";

// Adds a measurable weekly target to `week`. ALL_SPORTS stores NULL, meaning
// the objective spans every sport.
export function AddObjectiveSheet({
	week,
	onClose,
}: {
	week: string | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertWeekObjectiveMutation();
	const { data: sports } = useSportsQuery();
	const [sport, setSport] = useState(ALL_SPORTS);
	const [metric, setMetric] = useState<string>(METRICS[0]);
	const [target, setTarget] = useState<number | null>(null);
	const meta = METRIC_META[metric as Metric];
	const SportIcon = sportIcon(sport === ALL_SPORTS ? null : sport);
	const sportLabel =
		sports?.find((s) => s.value === sport)?.label ?? "All sports";

	const resetAndClose = () => {
		setSport(ALL_SPORTS);
		setMetric(METRICS[0]);
		setTarget(null);
		onClose();
	};

	const save = async () => {
		if (!week || target === null || insert.isPending) return;
		try {
			await insert.mutateAsync({
				object: {
					week,
					sport: sport === ALL_SPORTS ? null : sport,
					metric,
					target: meta.toBase(target),
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["week-objectives"] });
			resetAndClose();
		} catch {
			toast.error("Could not add the objective");
		}
	};

	return (
		<Sheet
			open={week !== null}
			onOpenChange={(open) => !open && resetAndClose()}
		>
			<SheetContent side="right" className="gap-5 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Add objective</SheetTitle>
					<SheetDescription>
						{week ? `Weekly target for ${week}` : "Select a week"}
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
				<SheetFooter>
					<Button
						disabled={target === null || insert.isPending}
						onClick={() => void save()}
					>
						{insert.isPending ? "Saving…" : "Add objective"}
					</Button>
					<Button variant="ghost" onClick={resetAndClose}>
						Cancel
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
