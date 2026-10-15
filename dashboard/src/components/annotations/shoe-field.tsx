import { useEffect, useState } from "react";
import { Check, ChevronDown, Footprints } from "lucide-react";

import type { AnnotationInput } from "@/lib/annotations";
import {
	lifetimeHours,
	lifetimeKm,
	type Shoe,
	shoeSportFor,
	useShoes,
	wearsByDistance,
} from "@/lib/shoes";
import { cn } from "@/lib/utils";
import { Field } from "./fields";

interface PickerProps {
	shoes: Shoe[];
	others: Shoe[];
	selected: string;
	onPick: (id: string) => void;
}

function Thumb({ shoe, className }: { shoe?: Shoe; className?: string }) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white",
				className,
			)}
		>
			{shoe?.image_url ? (
				// biome-ignore lint/a11y/useAltText: decorative shoe thumbnail
				<img src={shoe.image_url} alt="" className="size-full object-contain" />
			) : (
				<Footprints className="size-[50%] text-neutral-400" />
			)}
		</div>
	);
}

function wearLabel(shoe: Shoe): string {
	return wearsByDistance(shoe.sport)
		? `${lifetimeKm(shoe).toFixed(0)} km`
		: `${lifetimeHours(shoe).toFixed(0)} h`;
}

const id = (shoe: Shoe) => String(shoe.id);

// Shoes for other sports sit behind a toggle, since picking
// one is rare (e.g. hiking in climbing approach shoes).
function OthersToggle({
	count,
	open,
	onToggle,
}: {
	count: number;
	open: boolean;
	onToggle: () => void;
}) {
	if (count === 0) return null;
	return (
		<button
			type="button"
			onClick={onToggle}
			className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
		>
			<ChevronDown className={cn("size-3", open && "rotate-180")} />
			{open ? "Hide other shoes" : `Other shoes (${count})`}
		</button>
	);
}

// Gallery: every shoe as a picture card; click to select, click again to clear.
function GalleryPicker({ shoes, others, selected, onPick }: PickerProps) {
	const [showOthers, setShowOthers] = useState(false);
	const list = showOthers ? [...shoes, ...others] : shoes;
	return (
		<div className="space-y-2">
			<div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2">
				{list.map((shoe) => {
					const on = selected === id(shoe);
					return (
						<button
							key={id(shoe)}
							type="button"
							aria-pressed={on}
							onClick={() => onPick(on ? "" : id(shoe))}
							className={cn(
								"relative flex flex-col overflow-hidden rounded-lg border text-left transition",
								on
									? "border-primary ring-primary ring-2"
									: "hover:border-foreground/30 opacity-80 hover:opacity-100",
							)}
						>
							<Thumb
								shoe={shoe}
								className={cn(
									"aspect-[4/3] w-full rounded-none p-1.5",
									shoe.archived && "grayscale",
								)}
							/>
							<div className="px-2 py-1.5">
								<div className="text-xs leading-tight font-medium">{shoe.name}</div>
								<div className="text-muted-foreground text-[11px] tabular-nums">
									{wearLabel(shoe)}
									{shoe.archived && " · archived"}
								</div>
							</div>
							{on && (
								<Check className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 size-5 rounded-full p-0.5" />
							)}
						</button>
					);
				})}
			</div>
			<OthersToggle
				count={others.length}
				open={showOthers}
				onToggle={() => setShowOthers((v) => !v)}
			/>
		</div>
	);
}

// Shoe picker for an activity. Keeps a local selection so the choice shows
// immediately, independent of when the activity query refetches it.
export function ShoeField({
	activity,
	sport,
	onSave,
	required = false,
}: {
	activity: { shoe_id: number | string | null };
	sport?: string;
	onSave: (patch: AnnotationInput) => unknown;
	required?: boolean;
}) {
	const shoes = useShoes();
	const [selected, setSelected] = useState(
		activity.shoe_id == null ? "" : String(activity.shoe_id),
	);
	useEffect(() => {
		setSelected(activity.shoe_id == null ? "" : String(activity.shoe_id));
	}, [activity.shoe_id]);

	const all = shoes.data?.shoes ?? [];
	const preferred = sport ? shoeSportFor(sport) : null;
	const byWear = (a: Shoe, b: Shoe) => lifetimeKm(b) - lifetimeKm(a);
	// Archived shoes always go behind "Other shoes", even for their own sport.
	const isMine = (shoe: Shoe) =>
		!shoe.archived && (!preferred || shoe.sport === preferred);
	const mine = all.filter(isMine).sort(byWear);
	const others = all
		.filter((shoe) => !isMine(shoe))
		.sort((a, b) => Number(a.archived) - Number(b.archived) || byWear(a, b));

	const pick = (next: string) => {
		setSelected(next);
		void onSave({ shoe_id: next ? Number(next) : null });
	};

	return (
		<Field
			label="Shoe"
			error={required && !selected ? "Pick the shoe you used." : undefined}
		>
			{all.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					No shoes — add one in Settings.
				</p>
			) : (
				<GalleryPicker
					shoes={mine}
					others={others}
					selected={selected}
					onPick={pick}
				/>
			)}
		</Field>
	);
}
