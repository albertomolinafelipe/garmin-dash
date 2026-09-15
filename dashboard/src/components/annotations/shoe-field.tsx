import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Footprints } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { AnnotationInput } from "@/lib/annotations";
import { type Shoe, useShoes } from "@/lib/shoes";
import { cn } from "@/lib/utils";
import { Field } from "./fields";

// White background so shoe photos with transparent cutouts read cleanly, and
// object-contain so the whole shoe shows rather than being cropped.
function ShoeThumb({ shoe, className }: { shoe?: Shoe; className?: string }) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white",
				className,
			)}
		>
			{shoe?.image_url ? (
				// biome-ignore lint/a11y/useAltText: decorative shoe thumbnail
				<img src={shoe.image_url} alt="" className="size-full object-contain" />
			) : (
				<Footprints className="size-[55%] text-neutral-400" />
			)}
		</div>
	);
}

// Shoe picker with thumbnails and search. Keeps a local selection so the choice
// shows immediately, independent of when the activity query refetches it.
export function ShoeField({
	activity,
	onSave,
	required = false,
}: {
	activity: { shoe_id: number | string | null };
	onSave: (patch: AnnotationInput) => unknown;
	required?: boolean;
}) {
	const shoes = useShoes();
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState(
		activity.shoe_id == null ? "" : String(activity.shoe_id),
	);
	useEffect(() => {
		setSelected(activity.shoe_id == null ? "" : String(activity.shoe_id));
	}, [activity.shoe_id]);

	const list = shoes.data?.shoes ?? [];
	const current = list.find((shoe) => String(shoe.id) === selected);

	const pick = (id: string) => {
		setSelected(id);
		setOpen(false);
		void onSave({ shoe_id: id ? Number(id) : null });
	};

	return (
		<Field
			label="Shoe"
			error={required && !selected ? "Pick the shoe you used." : undefined}
		>
			<div className="space-y-2">
			{current ? (
				<div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white">
					{current.image_url ? (
						// biome-ignore lint/a11y/useAltText: decorative shoe preview
						<img
							src={current.image_url}
							alt={current.name}
							className="size-full object-contain p-2"
						/>
					) : (
						<Footprints className="size-16 text-neutral-400" />
					)}
				</div>
			) : null}
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						// biome-ignore lint/a11y/useSemanticElements: combobox trigger
						role="combobox"
						aria-expanded={open}
						className="h-auto w-full justify-between py-1.5"
					>
						{current ? (
							<span className="flex min-w-0 items-center gap-2">
								<ShoeThumb shoe={current} className="size-8" />
								<span className="truncate">{current.name}</span>
							</span>
						) : (
							<span className="text-muted-foreground">Choose a shoe</span>
						)}
						<ChevronsUpDown className="size-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="w-[var(--radix-popover-trigger-width)] p-0"
					align="start"
				>
					<Command>
						<CommandInput placeholder="Search shoes…" />
						<CommandList>
							<CommandEmpty>No shoes — add one in Settings.</CommandEmpty>
							<CommandGroup>
								{list.map((shoe) => (
									<CommandItem
										key={String(shoe.id)}
										value={shoe.name}
										onSelect={() => pick(String(shoe.id))}
										className="gap-2"
									>
										<ShoeThumb shoe={shoe} className="size-10" />
										<span className="truncate">{shoe.name}</span>
										<Check
											className={cn(
												"ml-auto size-4",
												selected === String(shoe.id)
													? "opacity-100"
													: "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
			</div>
		</Field>
	);
}
