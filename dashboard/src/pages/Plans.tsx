import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { useNavigate, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { PlanCalendar } from "@/components/plan-calendar";
import { TimelineList } from "@/components/timeline-list";
import { useActivities } from "@/lib/queries";
import {
	useDeletePlanMutation,
	useInsertPlanMutation,
	useInsertRaceMutation,
	useDeleteRaceMutation,
	useRacesQuery,
	usePlansQuery,
	useUpdatePlanMutation,
} from "@/graphql/hooks";
import {
	currentIsoWeek,
	isIsoWeek,
	planIsActive,
	raceIcon as RaceIcon,
	weeksInRange,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

type Plan = {
	id: unknown;
	name: string;
	start_week: string;
	end_week: string;
	notes: string | null;
};

type PlanFormValues = {
	name: string;
	start_week: string;
	end_week: string;
	notes: string | null;
};

function PlanForm({
	initial,
	submitting,
	submitLabel,
	pendingLabel,
	onSubmit,
}: {
	initial?: PlanFormValues;
	submitting: boolean;
	submitLabel: string;
	pendingLabel: string;
	onSubmit: (values: PlanFormValues) => void;
}) {
	const [month, setMonth] = useState<Date>(new Date());
	const [name, setName] = useState(initial?.name ?? "");
	const [startWeek, setStartWeek] = useState(initial?.start_week ?? "");
	const [endWeek, setEndWeek] = useState(initial?.end_week ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");

	const orderInvalid =
		isIsoWeek(startWeek) && isIsoWeek(endWeek) && endWeek < startWeek;
	const valid =
		name.trim() !== "" &&
		isIsoWeek(startWeek) &&
		isIsoWeek(endWeek) &&
		!orderInvalid;

	const submit = () => {
		if (!valid || submitting) return;
		onSubmit({
			name: name.trim(),
			start_week: startWeek,
			end_week: endWeek,
			notes: notes.trim() || null,
		});
	};

	return (
		<>
			<div className="flex-1 space-y-5 overflow-y-auto px-4">
				<div className="flex justify-center">
					<Calendar
						mode="single"
						ISOWeek
						showWeekNumber
						captionLayout="dropdown"
						month={month}
						onMonthChange={setMonth}
						className="rounded-lg border"
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="plan-name">Name</Label>
					<Input
						id="plan-name"
						value={name}
						placeholder="e.g. Base build 2026"
						disabled={submitting}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="grid gap-2">
						<Label htmlFor="plan-start">Start week</Label>
						<Input
							id="plan-start"
							value={startWeek}
							placeholder="2026-W01"
							disabled={submitting}
							onChange={(event) => setStartWeek(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="plan-end">End week</Label>
						<Input
							id="plan-end"
							value={endWeek}
							placeholder="2026-W04"
							disabled={submitting}
							onChange={(event) => setEndWeek(event.target.value)}
						/>
					</div>
				</div>
				<p className="text-muted-foreground text-sm">
					Format: ISO year-week, e.g. <code>2026-W01</code>. Use the calendar
					above to look up week numbers.
				</p>
				{orderInvalid ? (
					<p className="text-destructive text-sm">
						End week must not be before the start week.
					</p>
				) : null}
				<div className="grid gap-2">
					<Label htmlFor="plan-notes">Notes (markdown)</Label>
					<Textarea
						id="plan-notes"
						value={notes}
						rows={8}
						placeholder="Supports **markdown**"
						disabled={submitting}
						onChange={(event) => setNotes(event.target.value)}
					/>
				</div>
			</div>
			<SheetFooter>
				<Button disabled={!valid || submitting} onClick={submit}>
					{submitting ? pendingLabel : submitLabel}
				</Button>
			</SheetFooter>
		</>
	);
}

function PlanSheet({
	open,
	onOpenChange,
	plan,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	plan?: Plan;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertPlanMutation();
	const update = useUpdatePlanMutation();
	const editing = plan != null;
	const submitting = editing ? update.isPending : insert.isPending;

	const submit = async (values: PlanFormValues) => {
		try {
			if (editing) {
				await update.mutateAsync({ id: plan.id, set: values });
			} else {
				await insert.mutateAsync({ object: values });
			}
			await queryClient.invalidateQueries({ queryKey: ["plans"] });
			toast.success(editing ? "Plan updated" : "Plan created");
			onOpenChange(false);
		} catch {
			toast.error(
				editing ? "Could not update the plan" : "Could not create the plan",
			);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>{editing ? "Edit plan" : "New plan"}</SheetTitle>
					<SheetDescription>
						{editing
							? "Update the plan's details."
							: "A plan spans a range of ISO weeks and holds weekly requirements and planned workouts."}
					</SheetDescription>
				</SheetHeader>
				<PlanForm
					initial={
						editing
							? {
									name: plan.name,
									start_week: plan.start_week,
									end_week: plan.end_week,
									notes: plan.notes,
								}
							: undefined
					}
					submitting={submitting}
					submitLabel={editing ? "Save changes" : "Create plan"}
					pendingLabel={editing ? "Saving…" : "Creating…"}
					onSubmit={(values) => void submit(values)}
				/>
			</SheetContent>
		</Sheet>
	);
}

function DeletePlanButton({ plan, onDelete }: { plan: Plan; onDelete: () => void }) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="text-muted-foreground hover:text-destructive"
					aria-label={`Delete ${plan.name}`}
				>
					<Trash2 className="size-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete {plan.name}?</AlertDialogTitle>
					<AlertDialogDescription>
						This removes the plan and all its requirements and workouts.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function RaceSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertRaceMutation();
	const [date, setDate] = useState("");
	const [name, setName] = useState("");
	const [distanceKm, setDistanceKm] = useState<number | null>(null);
	const [elevationM, setElevationM] = useState<number | null>(null);

	const valid = date !== "" && name.trim() !== "";

	const create = async () => {
		if (!valid || insert.isPending) return;
		try {
			await insert.mutateAsync({
				object: {
					date,
					name: name.trim(),
					distance_m: distanceKm == null ? null : distanceKm * 1000,
					elevation_gain_m: elevationM,
				},
			});
			await queryClient.invalidateQueries({ queryKey: ["races"] });
			setDate("");
			setName("");
			setDistanceKm(null);
			setElevationM(null);
			onOpenChange(false);
		} catch {
			toast.error("Could not create the race");
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>New race</SheetTitle>
					<SheetDescription>An upcoming or past race event.</SheetDescription>
				</SheetHeader>
				<div className="flex-1 space-y-5 overflow-y-auto px-4">
					<div className="grid gap-2">
						<Label htmlFor="race-date">Date</Label>
						<DatePicker
							id="race-date"
							value={date}
							disabled={insert.isPending}
							onChange={setDate}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="race-name">Name</Label>
						<Input
							id="race-name"
							value={name}
							placeholder="e.g. Zegama Marathon"
							disabled={insert.isPending}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="grid gap-2">
							<Label htmlFor="race-distance">Distance (km)</Label>
							<NumberInput
								id="race-distance"
								nonNegative
								value={distanceKm}
								disabled={insert.isPending}
								onChange={setDistanceKm}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="race-elevation">Elevation (m)</Label>
							<NumberInput
								id="race-elevation"
								nonNegative
								value={elevationM}
								disabled={insert.isPending}
								onChange={setElevationM}
							/>
						</div>
					</div>
				</div>
				<SheetFooter>
					<Button
						disabled={!valid || insert.isPending}
						onClick={() => void create()}
					>
						{insert.isPending ? "Creating…" : "Create race"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

function RacesSheet({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const races = useRacesQuery();
	const activities = useActivities();
	const remove = useDeleteRaceMutation();
	const [createOpen, setCreateOpen] = useState(false);
	const today = new Date().toISOString().slice(0, 10);
	const list = [...(races.data ?? [])].sort((a, b) =>
		String(a.date).localeCompare(String(b.date)),
	);

	// Local calendar date -> activity ids started that day. A race links to its
	// day's activity only when exactly one exists.
	const byDay = new Map<string, string[]>();
	for (const activity of activities.data?.activities ?? []) {
		if (!activity.start_time) continue;
		const day = format(new Date(activity.start_time), "yyyy-MM-dd");
		const ids = byDay.get(day) ?? [];
		ids.push(String(activity.id));
		byDay.set(day, ids);
	}
	const activityForRace = (date: string): string | null => {
		const ids = byDay.get(date);
		return ids && ids.length === 1 ? ids[0] : null;
	};

	const del = async (id: unknown) => {
		try {
			await remove.mutateAsync({ id });
			await queryClient.invalidateQueries({ queryKey: ["races"] });
		} catch {
			toast.error("Could not delete race");
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Races</SheetTitle>
					<SheetDescription>
						{list.length} total. Races show up on every calendar.
					</SheetDescription>
				</SheetHeader>
				<div className="flex min-h-0 flex-1 flex-col">
					<div className="px-4 pb-2">
						<Button size="sm" onClick={() => setCreateOpen(true)}>
							<Plus className="size-4" />
							New race
						</Button>
						<RaceSheet open={createOpen} onOpenChange={setCreateOpen} />
					</div>
					<TimelineList
						items={list}
						getKey={(race) => String(race.id)}
						isPast={(race) => String(race.date) < today}
						loading={races.isLoading}
						empty={
							<p className="text-muted-foreground p-4 text-center text-sm">
								No races yet.
							</p>
						}
						renderItem={(race) => {
							const dist = Number(race.distance_m);
							const elev = Number(race.elevation_gain_m);
							const meta = [
								dist ? `${(dist / 1000).toFixed(1)} km` : null,
								elev ? `${Math.round(elev)} m` : null,
							]
								.filter(Boolean)
								.join(" · ");
							const activityId = activityForRace(String(race.date));
							return (
								<div className="hover:bg-muted group flex items-center gap-2 rounded-lg">
									<button
										type="button"
										disabled={activityId == null}
										onClick={() =>
											activityId && navigate(`/activities/${activityId}`)
										}
										className={cn(
											"min-w-0 flex-1 p-2 text-left",
											activityId != null && "cursor-pointer",
										)}
									>
										<span className="flex items-center gap-1.5 truncate text-sm font-medium">
											{String(race.date) < today ? (
												<RaceIcon className="text-race size-4 shrink-0" />
											) : null}
											<span className="truncate">{race.name}</span>
										</span>
										<span className="text-muted-foreground block truncate text-xs">
											{format(
												new Date(`${String(race.date)}T00:00:00`),
												"d MMM yyyy",
											)}
											{meta ? ` · ${meta}` : ""}
										</span>
									</button>
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-destructive mr-1 size-8 shrink-0 opacity-0 group-hover:opacity-100"
										aria-label={`Delete ${race.name}`}
										onClick={() => void del(race.id)}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							);
						}}
					/>
				</div>
			</SheetContent>
		</Sheet>
	);
}

export function Plans() {
	const queryClient = useQueryClient();
	const plans = usePlansQuery();
	const remove = useDeletePlanMutation();
	const [searchParams, setSearchParams] = useSearchParams();
	const [createOpen, setCreateOpen] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [racesOpen, setRacesOpen] = useState(false);

	const week = currentIsoWeek();
	const all = plans.data ?? [];
	const active = all.filter((plan) => planIsActive(plan, week));
	// Chronological by end week; past plans stay selectable in the picker.
	const ordered = [...all].sort(
		(a, b) =>
			a.end_week.localeCompare(b.end_week) ||
			a.start_week.localeCompare(b.start_week),
	);
	const selected =
		all.find((plan) => String(plan.id) === searchParams.get("plan")) ??
		active[0] ??
		all[0] ??
		null;

	const selectPlan = (id: string) =>
		setSearchParams(
			(prev) => {
				prev.set("plan", id);
				return prev;
			},
			{ replace: true },
		);

	const deletePlan = async (plan: Plan) => {
		try {
			await remove.mutateAsync({ id: plan.id });
			await queryClient.invalidateQueries({ queryKey: ["plans"] });
			setSearchParams(
				(prev) => {
					prev.delete("plan");
					return prev;
				},
				{ replace: true },
			);
		} catch {
			toast.error(`Could not delete ${plan.name}`);
		}
	};

	return (
		<div className="flex h-full min-h-[520px] flex-col gap-3 p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<Select
						value={selected ? String(selected.id) : ""}
						onValueChange={selectPlan}
					>
						<SelectTrigger className="w-56">
							<span className="truncate">
								{selected?.name ?? "No plans yet"}
							</span>
						</SelectTrigger>
						<SelectContent>
							{ordered.map((plan) => (
								<SelectItem key={String(plan.id)} value={String(plan.id)}>
									<span className="flex items-center gap-2">
										<span
											className={cn(
												"size-2 shrink-0 rounded-full",
												planIsActive(plan, week)
													? "bg-primary"
													: "bg-muted-foreground/30",
											)}
										/>
										{plan.name}
									</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{selected ? (
						<>
							<span className="text-muted-foreground text-xs tabular-nums">
								{selected.start_week} – {selected.end_week} ·{" "}
								{weeksInRange(selected.start_week, selected.end_week).length}{" "}
								weeks
							</span>
							{planIsActive(selected, week) ? (
								<Badge variant="secondary">Active</Badge>
							) : null}
						</>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => setRacesOpen(true)}>
						<Flag className="size-4" />
						Races
					</Button>
					{selected ? (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEditOpen(true)}
							>
								<Pencil className="size-4" />
								Edit
							</Button>
							<DeletePlanButton
								plan={selected}
								onDelete={() => void deletePlan(selected)}
							/>
						</>
					) : null}
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" />
						New plan
					</Button>
				</div>
			</div>

			<RacesSheet open={racesOpen} onOpenChange={setRacesOpen} />
			<PlanSheet open={createOpen} onOpenChange={setCreateOpen} />
			{selected ? (
				<PlanSheet
					key={String(selected.id)}
					plan={selected}
					open={editOpen}
					onOpenChange={setEditOpen}
				/>
			) : null}

			{selected?.notes ? (
				<Collapsible>
					<CollapsibleTrigger className="text-muted-foreground hover:text-foreground group flex items-center gap-1 text-xs">
						<ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
						Notes
					</CollapsibleTrigger>
					<CollapsibleContent className="text-muted-foreground mt-1 space-y-1 text-sm [&_a]:underline [&_h1]:font-semibold [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ul]:my-1">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{selected.notes}
						</ReactMarkdown>
					</CollapsibleContent>
				</Collapsible>
			) : null}

			{selected ? (
				<PlanCalendar key={String(selected.id)} plan={selected} />
			) : (
				<div className="text-muted-foreground bg-card flex flex-1 items-center justify-center rounded-xl border p-8 text-sm">
					{plans.isLoading ? "Loading plans…" : "Create a plan to get started."}
				</div>
			)}
		</div>
	);
}
