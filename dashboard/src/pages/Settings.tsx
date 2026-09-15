import { type FocusEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Footprints, Plus, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { TagsInput } from "@/components/ui/tags-input";
import { TimelineList } from "@/components/timeline-list";
import { useActivities } from "@/lib/queries";
import { dayKey } from "@/lib/format";
import {
	type Shoe,
	lifetimeKm,
	useDeleteShoe,
	useInsertShoe,
	useShoes,
} from "@/lib/shoes";
import { cn } from "@/lib/utils";
import {
	useDeleteExerciseMutation,
	useDeleteRaceMutation,
	useExercisesQuery,
	useInsertExerciseMutation,
	useInsertRaceMutation,
	useRacesQuery,
	useUpdateExerciseMutation,
} from "@/graphql/hooks";
import { raceIcon as RaceIcon } from "@/lib/plans";

// --- Exercises ----------------------------------------------------------------

function exerciseError(error: unknown) {
	const message = error instanceof Error ? error.message.toLowerCase() : "";
	if (message.includes("unique") || message.includes("duplicate")) {
		return "An exercise with that name already exists";
	}
	return "Could not save the exercise";
}

function ExerciseRow({
	exercise,
	pending,
	onPendingChange,
}: {
	exercise: { id: unknown; name: string; categories: string[] };
	pending: boolean;
	onPendingChange: (pending: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const update = useUpdateExerciseMutation();
	const remove = useDeleteExerciseMutation();
	const [name, setName] = useState(exercise.name);
	const [categories, setCategories] = useState<string[]>(
		exercise.categories ?? [],
	);

	useEffect(() => {
		if (!update.isPending) {
			setName(exercise.name);
			setCategories(exercise.categories ?? []);
		}
	}, [exercise, update.isPending]);

	const runUpdate = async (set: { name?: string; categories?: string[] }) => {
		onPendingChange(true);
		try {
			await update.mutateAsync({ id: exercise.id, set });
			await queryClient.invalidateQueries({ queryKey: ["exercises"] });
		} catch (error) {
			setName(exercise.name);
			setCategories(exercise.categories ?? []);
			toast.error(exerciseError(error));
		} finally {
			onPendingChange(false);
		}
	};

	const saveName = () => {
		const normalized = name.trim();
		if (!normalized) return setName(exercise.name);
		if (normalized !== exercise.name) void runUpdate({ name: normalized });
	};
	const saveCategories = (event: FocusEvent<HTMLFieldSetElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
		if (
			JSON.stringify(categories) !== JSON.stringify(exercise.categories ?? [])
		) {
			void runUpdate({ categories: categories ?? [] });
		}
	};
	const deleteExercise = async () => {
		onPendingChange(true);
		try {
			await remove.mutateAsync({ id: exercise.id });
			await queryClient.invalidateQueries({ queryKey: ["exercises"] });
		} catch (error) {
			toast.error(exerciseError(error));
		} finally {
			onPendingChange(false);
		}
	};

	return (
		<div className="hover:bg-muted/40 group flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
			<Input
				aria-label={`Name for ${exercise.name}`}
				value={name}
				disabled={pending}
				className="border-transparent font-medium shadow-none focus-visible:border-input hover:border-input sm:w-52"
				onChange={(event) => setName(event.target.value)}
				onBlur={saveName}
			/>
			<fieldset
				className="min-w-0 flex-1"
				disabled={pending}
				onBlur={saveCategories}
			>
				<TagsInput
					aria-label={`Categories for ${exercise.name}`}
					value={categories}
					onChange={setCategories}
					disabled={pending}
					placeholder="Add category"
				/>
			</fieldset>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						disabled={pending}
						aria-label={`Delete ${exercise.name}`}
						className="text-muted-foreground hover:text-destructive shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
					>
						<Trash2 className="size-4" />
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {exercise.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes the exercise from the catalog.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => void deleteExercise()}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function ExercisesCard() {
	const queryClient = useQueryClient();
	const exercises = useExercisesQuery();
	const insert = useInsertExerciseMutation();
	const [name, setName] = useState("");
	const [categories, setCategories] = useState<string[]>([]);
	const [rowPending, setRowPending] = useState(0);
	const pending = insert.isPending || rowPending > 0;

	const addExercise = async () => {
		const normalized = name.trim();
		if (!normalized || pending) return;
		try {
			await insert.mutateAsync({ name: normalized, categories: categories ?? [] });
			setName("");
			setCategories([]);
			await queryClient.invalidateQueries({ queryKey: ["exercises"] });
		} catch (error) {
			toast.error(exerciseError(error));
		}
	};

	const rows = exercises.data?.exercises ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Exercise catalog</CardTitle>
				<CardDescription>
					Exercises available to strength annotations, with their equipment tags.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="bg-muted/30 flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center">
					<Input
						aria-label="New exercise name"
						value={name}
						disabled={pending}
						placeholder="Exercise name"
						className="sm:w-52"
						onChange={(event) => setName(event.target.value)}
					/>
					<div className="min-w-0 flex-1">
						<TagsInput
							aria-label="New exercise categories"
							value={categories}
							onChange={setCategories}
							disabled={pending}
							placeholder="Add category"
						/>
					</div>
					<Button
						disabled={pending || !name.trim()}
						onClick={() => void addExercise()}
					>
						<Plus className="size-4" />
						Add exercise
					</Button>
				</div>

				{exercises.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading exercises…</p>
				) : exercises.isError ? (
					<p className="text-destructive text-sm">Could not load exercises.</p>
				) : rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">No exercises yet.</p>
				) : (
					<div className="divide-y rounded-lg border">
						{rows.map((exercise) => (
							<ExerciseRow
								key={String(exercise.id)}
								exercise={exercise}
								pending={pending}
								onPendingChange={(active) =>
									setRowPending((count) => Math.max(0, count + (active ? 1 : -1)))
								}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// --- Races --------------------------------------------------------------------

function RaceDialog({
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
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New race</DialogTitle>
					<DialogDescription>An upcoming or past race event.</DialogDescription>
				</DialogHeader>
				<div className="space-y-5">
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
				<DialogFooter>
					<Button disabled={!valid || insert.isPending} onClick={() => void create()}>
						{insert.isPending ? "Creating…" : "Create race"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function RacesCard() {
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
		const day = dayKey(new Date(activity.start_time));
		byDay.set(day, [...(byDay.get(day) ?? []), String(activity.id)]);
	}
	const activityForRace = (date: string): string | null => {
		const ids = byDay.get(date);
		return ids && ids.length === 1 ? ids[0] : null;
	};

	const deleteRace = async (id: unknown) => {
		try {
			await remove.mutateAsync({ id });
			await queryClient.invalidateQueries({ queryKey: ["races"] });
		} catch {
			toast.error("Could not delete race");
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Races</CardTitle>
				<CardDescription>
					Races show on the calendar on their date, past ones flagged.
				</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" />
						New race
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				<TimelineList
					items={list}
					getKey={(race) => String(race.id)}
					isPast={(race) => String(race.date) < today}
					loading={races.isLoading}
					empty={
						<p className="text-muted-foreground py-6 text-center text-sm">
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
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="text-muted-foreground hover:text-destructive mr-1 size-8 shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
											aria-label={`Delete ${race.name}`}
										>
											<Trash2 className="size-4" />
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>Delete {race.name}?</AlertDialogTitle>
											<AlertDialogDescription>
												This removes the race from the calendar.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction onClick={() => void deleteRace(race.id)}>
												Delete
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						);
					}}
				/>
				<RaceDialog open={createOpen} onOpenChange={setCreateOpen} />
			</CardContent>
		</Card>
	);
}

// --- Shoes --------------------------------------------------------------------

function ShoeDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertShoe();
	const [name, setName] = useState("");
	const [imageUrl, setImageUrl] = useState("");
	const [startingKm, setStartingKm] = useState<number | null>(null);

	const valid = name.trim() !== "";

	const create = async () => {
		if (!valid || insert.isPending) return;
		try {
			await insert.mutateAsync({
				name: name.trim(),
				image_url: imageUrl.trim() || null,
				starting_km: startingKm ?? 0,
			});
			await queryClient.invalidateQueries({ queryKey: ["shoes"] });
			setName("");
			setImageUrl("");
			setStartingKm(null);
			onOpenChange(false);
		} catch {
			toast.error("Could not add the shoe");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New shoe</DialogTitle>
					<DialogDescription>
						Starting km seeds distance run before importing.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-5">
					<div className="grid gap-2">
						<Label htmlFor="shoe-name">Name</Label>
						<Input
							id="shoe-name"
							value={name}
							placeholder="e.g. Saucony Peregrine 14"
							disabled={insert.isPending}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="shoe-image">Image URL</Label>
						<Input
							id="shoe-image"
							value={imageUrl}
							placeholder="https://…"
							disabled={insert.isPending}
							onChange={(event) => setImageUrl(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="shoe-starting-km">Starting km</Label>
						<NumberInput
							id="shoe-starting-km"
							nonNegative
							value={startingKm}
							disabled={insert.isPending}
							onChange={setStartingKm}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button disabled={!valid || insert.isPending} onClick={() => void create()}>
						{insert.isPending ? "Adding…" : "Add shoe"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ShoeRow({ shoe }: { shoe: Shoe }) {
	const queryClient = useQueryClient();
	const remove = useDeleteShoe();
	const km = lifetimeKm(shoe);
	const count = shoe.activities_aggregate.aggregate?.count ?? 0;

	const deleteShoe = async () => {
		try {
			await remove.mutateAsync(shoe.id);
			await queryClient.invalidateQueries({ queryKey: ["shoes"] });
		} catch {
			toast.error("Could not delete the shoe");
		}
	};

	return (
		<div className="hover:bg-muted/40 group flex items-center gap-3 px-3 py-2.5">
			<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
				{shoe.image_url ? (
					// biome-ignore lint/a11y/useAltText: decorative shoe thumbnail
					<img
						src={shoe.image_url}
						alt={shoe.name}
						className="size-full object-contain"
					/>
				) : (
					<Footprints className="size-7 text-neutral-400" />
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{shoe.name}</div>
				<div className="text-muted-foreground text-xs tabular-nums">
					{km.toFixed(0)} km · {count} {count === 1 ? "activity" : "activities"}
				</div>
			</div>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Delete ${shoe.name}`}
						className="text-muted-foreground hover:text-destructive shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
					>
						<Trash2 className="size-4" />
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {shoe.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Activities logged in this shoe keep their record but lose the link.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => void deleteShoe()}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function ShoesCard() {
	const shoes = useShoes();
	const [createOpen, setCreateOpen] = useState(false);
	const rows = shoes.data?.shoes ?? [];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Shoes</CardTitle>
				<CardDescription>
					Gear for tracking mileage; pick one when annotating a run, hike or ski.
				</CardDescription>
				<CardAction>
					<Button size="sm" onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" />
						New shoe
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{shoes.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading shoes…</p>
				) : shoes.isError ? (
					<p className="text-destructive text-sm">Could not load shoes.</p>
				) : rows.length === 0 ? (
					<p className="text-muted-foreground py-6 text-center text-sm">
						No shoes yet.
					</p>
				) : (
					<div className="divide-y rounded-lg border">
						{rows.map((shoe) => (
							<ShoeRow key={String(shoe.id)} shoe={shoe} />
						))}
					</div>
				)}
				<ShoeDialog open={createOpen} onOpenChange={setCreateOpen} />
			</CardContent>
		</Card>
	);
}

export function Settings() {
	return (
		<div className="grid items-start gap-4 p-4 lg:grid-cols-2">
			<ExercisesCard />
			<RacesCard />
			<ShoesCard />
		</div>
	);
}
