import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
	Archive,
	ArchiveRestore,
	ChevronDown,
	Clock,
	Footprints,
	Mountain,
	Plus,
	Route,
	Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { SegmentedField, cap } from "@/components/annotations/fields";
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
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { NumberInput } from "@/components/ui/number-input";
import { categoryColor, categoryIcon } from "@/lib/activity-types";
import {
	lifetimeElevationM,
	lifetimeHours,
	lifetimeKm,
	SHOE_SPORTS,
	type Shoe,
	type ShoeSport,
	useDeleteShoe,
	useInsertShoe,
	useShoes,
	useUpdateShoe,
	wearsByDistance,
} from "@/lib/shoes";
import { cn } from "@/lib/utils";

// Most-used first: km for distance sports, hours for climbing.
function wear(shoe: Shoe): number {
	return wearsByDistance(shoe.sport) ? lifetimeKm(shoe) : lifetimeHours(shoe);
}

function ShoeThumb({ src, className }: { src: string; className?: string }) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
				className,
			)}
		>
			{src ? (
				// biome-ignore lint/a11y/useAltText: decorative shoe thumbnail
				<img src={src} alt="" className="size-full object-contain" />
			) : (
				<Footprints className="size-1/2 text-neutral-400" />
			)}
		</div>
	);
}

// One dialog for both adding (shoe undefined) and editing an existing shoe.
function ShoeDialog({
	shoe,
	defaultSport,
	open,
	onOpenChange,
}: {
	shoe?: Shoe;
	defaultSport: ShoeSport;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const insert = useInsertShoe();
	const update = useUpdateShoe();
	const pending = insert.isPending || update.isPending;
	const [name, setName] = useState("");
	const [sport, setSport] = useState<ShoeSport>(defaultSport);
	const [imageUrl, setImageUrl] = useState("");
	const [startingKm, setStartingKm] = useState<number | null>(null);

	// Reload the form each time the dialog opens, so a cancelled edit is dropped.
	useEffect(() => {
		if (!open) return;
		setName(shoe?.name ?? "");
		setSport(shoe?.sport ?? defaultSport);
		setImageUrl(shoe?.image_url ?? "");
		const km = Number(shoe?.starting_km ?? 0);
		setStartingKm(km > 0 ? km : null);
	}, [open, shoe, defaultSport]);

	const valid = name.trim() !== "";

	const submit = async () => {
		if (!valid || pending) return;
		const object = {
			name: name.trim(),
			sport,
			image_url: imageUrl.trim() || null,
			starting_km: wearsByDistance(sport) ? (startingKm ?? 0) : 0,
		};
		try {
			if (shoe) await update.mutateAsync({ id: shoe.id, set: object });
			else await insert.mutateAsync(object);
			await queryClient.invalidateQueries({ queryKey: ["shoes"] });
			onOpenChange(false);
		} catch {
			toast.error(shoe ? "Could not save the shoe" : "Could not add the shoe");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{shoe ? "Edit shoe" : "New shoe"}</DialogTitle>
					<DialogDescription>
						{wearsByDistance(sport)
							? "Starting km seeds distance covered before importing."
							: "Climbing shoes are tracked by hours used."}
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-5"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<SegmentedField
						label="Sport"
						value={sport}
						onChange={(next) => {
							if (next) setSport(next as ShoeSport);
						}}
						options={SHOE_SPORTS.map((value) => ({
							value,
							label: cap(value),
							icon: categoryIcon[value],
						}))}
					/>
					<div className="grid gap-2">
						<Label htmlFor="shoe-name">Name</Label>
						<Input
							id="shoe-name"
							value={name}
							placeholder="e.g. Saucony Peregrine 14"
							disabled={pending}
							autoFocus
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="shoe-image">Image URL</Label>
						<div className="flex items-center gap-3">
							<Input
								id="shoe-image"
								value={imageUrl}
								placeholder="https://…"
								disabled={pending}
								onChange={(event) => setImageUrl(event.target.value)}
							/>
							<ShoeThumb src={imageUrl.trim()} className="size-12" />
						</div>
					</div>
					{wearsByDistance(sport) && (
						<div className="grid gap-2">
							<Label htmlFor="shoe-starting-km">Starting km</Label>
							<NumberInput
								id="shoe-starting-km"
								nonNegative
								value={startingKm}
								placeholder="0"
								disabled={pending}
								onChange={setStartingKm}
							/>
						</div>
					)}
					<DialogFooter>
						<Button type="submit" disabled={!valid || pending}>
							{pending ? "Saving…" : shoe ? "Save" : "Add shoe"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ShoeRow({ shoe, onEdit }: { shoe: Shoe; onEdit: () => void }) {
	const queryClient = useQueryClient();
	const remove = useDeleteShoe();
	const update = useUpdateShoe();
	const count = shoe.activities_aggregate.aggregate?.count ?? 0;
	const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
	// Distance and climb only mean something for distance sports; time always does.
	const byDistance = wearsByDistance(shoe.sport);
	const elevation = lifetimeElevationM(shoe);
	const stats = [
		...(byDistance
			? [{ icon: Route, label: "Distance", value: `${number.format(lifetimeKm(shoe))} km` }]
			: []),
		{ icon: Clock, label: "Time", value: `${number.format(lifetimeHours(shoe))} h` },
		...(byDistance && elevation > 0
			? [{ icon: Mountain, label: "Elevation gain", value: `${number.format(elevation)} m` }]
			: []),
	];

	const deleteShoe = async () => {
		try {
			await remove.mutateAsync(shoe.id);
			await queryClient.invalidateQueries({ queryKey: ["shoes"] });
		} catch {
			toast.error("Could not delete the shoe");
		}
	};

	const toggleArchived = async () => {
		try {
			await update.mutateAsync({
				id: shoe.id,
				set: { archived: !shoe.archived },
			});
			await queryClient.invalidateQueries({ queryKey: ["shoes"] });
		} catch {
			toast.error(
				shoe.archived ? "Could not restore the shoe" : "Could not archive the shoe",
			);
		}
	};

	return (
		<div
			className={cn(
				"hover:bg-muted/40 group flex items-center gap-1 pr-1 pl-2",
				shoe.archived && "text-muted-foreground",
			)}
		>
			<button
				type="button"
				onClick={onEdit}
				aria-label={`Edit ${shoe.name}`}
				className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
			>
				<ShoeThumb
					src={shoe.image_url ?? ""}
					className={cn("size-16", shoe.archived && "opacity-50 grayscale")}
				/>
				<span className="flex min-w-0 flex-col gap-1">
					<span className="text-sm leading-tight font-medium break-words">
						{shoe.name}
					</span>
					<span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
						{stats.map(({ icon: Icon, label, value }) => (
							<span key={label} className="flex items-center gap-1" title={label}>
								<Icon className="size-3" aria-hidden />
								<span className="sr-only">{label}: </span>
								{value}
							</span>
						))}
					</span>
					<span className="text-muted-foreground text-[11px]">
						{count} {count === 1 ? "activity" : "activities"}
					</span>
				</span>
			</button>
			<Button
				variant="ghost"
				size="icon"
				aria-label={`${shoe.archived ? "Restore" : "Archive"} ${shoe.name}`}
				title={shoe.archived ? "Restore" : "Archive"}
				disabled={update.isPending}
				onClick={() => void toggleArchived()}
				className="text-muted-foreground hover:text-foreground size-6 shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
			>
				{shoe.archived ? (
					<ArchiveRestore className="size-3" />
				) : (
					<Archive className="size-3" />
				)}
			</Button>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Delete ${shoe.name}`}
						className="text-muted-foreground hover:text-destructive size-6 shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
					>
						<Trash2 className="size-3" />
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

export function ShoesCard() {
	const shoes = useShoes();
	const [dialog, setDialog] = useState<{
		open: boolean;
		shoe?: Shoe;
		sport: ShoeSport;
	}>({ open: false, sport: "running" });
	const all = shoes.data?.shoes ?? [];

	const section = (sport: ShoeSport, className?: string, listClass?: string) => {
		const Icon = categoryIcon[sport];
		const sorted = all
			.filter((shoe) => shoe.sport === sport)
			.sort((a, b) => wear(b) - wear(a));
		const active = sorted.filter((shoe) => !shoe.archived);
		const archived = sorted.filter((shoe) => shoe.archived);
		const list = (rows: Shoe[]) => (
			<div className={cn("grid divide-y rounded-md border sm:gap-x-2", listClass)}>
				{rows.map((shoe) => (
					<ShoeRow
						key={String(shoe.id)}
						shoe={shoe}
						onEdit={() => setDialog({ open: true, shoe, sport: shoe.sport })}
					/>
				))}
			</div>
		);
		return (
			<section className={cn("space-y-1.5", className)}>
				<h3 className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase">
					<Icon className="size-3.5" style={{ color: categoryColor[sport] }} />
					{cap(sport)}
				</h3>
				{active.length === 0 ? (
					<p className="text-muted-foreground rounded-md border border-dashed py-3 text-center text-xs">
						No {sport} shoes.
					</p>
				) : (
					list(active)
				)}
				{archived.length > 0 && (
					<Collapsible className="group/archived space-y-1.5">
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="text-muted-foreground h-7 w-full justify-between px-2 text-xs"
							>
								Archived · {archived.length}
								<ChevronDown className="size-4 transition-transform group-data-[state=open]/archived:rotate-180" />
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent>{list(archived)}</CollapsibleContent>
					</Collapsible>
				)}
			</section>
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Shoes</CardTitle>
				<CardAction>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setDialog({ open: true, sport: "running" })}
					>
						<Plus />
						New shoe
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent className="px-3">
				{shoes.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading shoes…</p>
				) : shoes.isError ? (
					<p className="text-destructive text-sm">Could not load shoes.</p>
				) : (
					// Running on the left; climbing and skiing stacked on the right.
					<div className="grid gap-2 sm:grid-cols-2">
						{section("running")}
						<div className="space-y-4">
							{section("climbing")}
							{section("skiing")}
						</div>
					</div>
				)}
				<ShoeDialog
					shoe={dialog.shoe}
					defaultSport={dialog.sport}
					open={dialog.open}
					onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
				/>
			</CardContent>
		</Card>
	);
}
