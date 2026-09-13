import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useInsertPlanWorkoutMutation } from "@/graphql/hooks";
import { dayToken, sportIcon, SPORTS, toIsoWeek } from "@/lib/plans";

export type PlanOption = {
	id: unknown;
	name: string;
	start_week: string;
	end_week: string;
};

// Adds a planned workout to `day`. With `planId` the plan is fixed (plan
// calendar); otherwise the user picks among the plans covering that ISO week.
export function AddWorkoutSheet({
	day,
	plans,
	planId: fixedPlanId,
	onClose,
}: {
	day: Date | null;
	plans: PlanOption[];
	planId?: string;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertPlanWorkoutMutation();
	const week = day ? toIsoWeek(day) : "";
	const eligiblePlans = plans.filter(
		(plan) => plan.start_week <= week && plan.end_week >= week,
	);
	const [pickedPlanId, setPickedPlanId] = useState("");
	const [sport, setSport] = useState<string>(SPORTS[0]);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const SportIcon = sportIcon(sport);
	const planId = fixedPlanId ?? pickedPlanId;

	const resetAndClose = () => {
		setPickedPlanId("");
		setSport(SPORTS[0]);
		setTitle("");
		setDescription("");
		onClose();
	};

	const save = async () => {
		if (!day || !planId || !title.trim() || insert.isPending) return;
		try {
			await insert.mutateAsync({
				object: {
					plan_id: planId,
					week,
					day_of_week: dayToken(day),
					sport,
					title: title.trim(),
					description: description.trim() || null,
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["plan-workouts"] });
			resetAndClose();
		} catch {
			toast.error("Could not add workout");
		}
	};

	return (
		<Sheet
			open={day !== null}
			onOpenChange={(open) => !open && resetAndClose()}
		>
			<SheetContent side="right" className="gap-5 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Add workout</SheetTitle>
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
									{sport}
								</span>
							</SelectTrigger>
							<SelectContent>
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
						<Label htmlFor="calendar-workout-title">Title</Label>
						<Input
							id="calendar-workout-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Easy run"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="calendar-workout-description">Description</Label>
						<Textarea
							id="calendar-workout-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Optional details"
						/>
					</div>
				</div>
				<SheetFooter>
					<Button
						disabled={!planId || !title.trim() || insert.isPending}
						onClick={() => void save()}
					>
						{insert.isPending ? "Saving…" : "Add workout"}
					</Button>
					<Button variant="ghost" onClick={resetAndClose}>
						Cancel
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
