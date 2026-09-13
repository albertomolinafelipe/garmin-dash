import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PlanOption } from "@/components/add-workout-sheet";
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
import { useInsertPlanRequirementMutation } from "@/graphql/hooks";
import {
	type Metric,
	METRIC_META,
	METRICS,
	sportIcon,
	SPORTS,
} from "@/lib/plans";

// Adds a weekly requirement to `week`. With `planId` the plan is fixed (plan
// calendar); otherwise the user picks among the plans covering that ISO week.
export function AddRequirementSheet({
	week,
	plans,
	planId: fixedPlanId,
	onClose,
}: {
	week: string | null;
	plans: PlanOption[];
	planId?: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertPlanRequirementMutation();
	const eligiblePlans = plans.filter(
		(plan) => week != null && plan.start_week <= week && plan.end_week >= week,
	);
	const [pickedPlanId, setPickedPlanId] = useState("");
	const [sport, setSport] = useState("all");
	const [metric, setMetric] = useState<string>(METRICS[0]);
	const [target, setTarget] = useState<number | null>(null);
	const meta = METRIC_META[metric as Metric];
	const SportIcon = sportIcon(sport === "all" ? null : sport);
	const planId = fixedPlanId ?? pickedPlanId;

	const resetAndClose = () => {
		setPickedPlanId("");
		setSport("all");
		setMetric(METRICS[0]);
		setTarget(null);
		onClose();
	};

	const save = async () => {
		if (!week || !planId || target === null || insert.isPending) return;
		try {
			await insert.mutateAsync({
				object: {
					plan_id: planId,
					week,
					sport: sport === "all" ? null : sport,
					metric,
					target: meta.toBase(target),
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["plan-requirements"] });
			resetAndClose();
		} catch {
			toast.error("Could not add the requirement");
		}
	};

	return (
		<Sheet
			open={week !== null}
			onOpenChange={(open) => !open && resetAndClose()}
		>
			<SheetContent side="right" className="gap-5 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Add requirement</SheetTitle>
					<SheetDescription>
						{week ? `Weekly target for ${week}` : "Select a week"}
					</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-4 px-4">
					{fixedPlanId ? null : (
						<div className="flex flex-col gap-2">
							<Label>Plan</Label>
							<Select value={pickedPlanId} onValueChange={setPickedPlanId}>
								<SelectTrigger className="w-full">
									<span>
										{eligiblePlans.find(
											(plan) => String(plan.id) === pickedPlanId,
										)?.name ?? "Select plan"}
									</span>
								</SelectTrigger>
								<SelectContent>
									{eligiblePlans.map((plan) => (
										<SelectItem key={String(plan.id)} value={String(plan.id)}>
											{plan.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{eligiblePlans.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									No plan covers ISO week {week}.
								</p>
							) : null}
						</div>
					)}
					<div className="flex flex-col gap-2">
						<Label>Sport</Label>
						<Select value={sport} onValueChange={setSport}>
							<SelectTrigger className="w-full">
								<span className="flex items-center gap-2">
									<SportIcon className="size-4" />
									{sport === "all" ? "All sports" : sport}
								</span>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">
									<span className="flex items-center gap-2">
										<SportIcon className="size-4" />
										All sports
									</span>
								</SelectItem>
								{SPORTS.map((value) => {
									const Icon = sportIcon(value);
									return (
										<SelectItem key={value} value={value}>
											<span className="flex items-center gap-2">
												<Icon className="size-4" />
												{value}
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
						<Label htmlFor="requirement-target">Target</Label>
						<div className="relative">
							<NumberInput
								id="requirement-target"
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
						disabled={!planId || target === null || insert.isPending}
						onClick={() => void save()}
					>
						{insert.isPending ? "Saving…" : "Add requirement"}
					</Button>
					<Button variant="ghost" onClick={resetAndClose}>
						Cancel
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
