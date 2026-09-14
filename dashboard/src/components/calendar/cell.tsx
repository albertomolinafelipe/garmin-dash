import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Content sits above the cell's full-bleed hit layer. Pointer events are off by
// default so clicks on empty space reach that layer; anything interactive
// (links, buttons, draggable chips) opts back in.
const CONTENT_LAYER =
	"pointer-events-none relative z-10 [&_[draggable]]:pointer-events-auto [&_a]:pointer-events-auto [&_button]:pointer-events-auto";

// A calendar cell whose empty space is itself a button. Hovering fades in a
// faint inset ring once — no looping flash — and thickens it by a pixel, so the
// affordance reads without competing with the events inside it. `onSelect`
// fires only for clicks that miss the content.
export function SelectableCell({
	onSelect,
	label,
	children,
	className,
	contentClassName,
	...props
}: {
	onSelect: () => void;
	label: string;
	children: ReactNode;
	className?: string;
	contentClassName?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div className={cn("group/cell relative", className)} {...props}>
			<button
				type="button"
				aria-label={label}
				onClick={onSelect}
				className="focus-visible:ring-ring group-hover/cell:ring-muted-foreground/25 absolute inset-0 z-0 cursor-pointer rounded-sm ring-1 ring-transparent ring-inset transition-[box-shadow] duration-300 ease-out group-hover/cell:ring-2 focus-visible:ring-2 focus-visible:outline-none"
			/>
			<div className={cn(CONTENT_LAYER, contentClassName)}>{children}</div>
		</div>
	);
}
