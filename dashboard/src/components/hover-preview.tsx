import { type ReactNode, useState } from "react";

import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

// Generic hover affordance: wraps any trigger and shows arbitrary content beside
// it. `content` is a function, not a node, so expensive previews (maps, queries)
// are only constructed once the card actually opens and are torn down on close.
// Nothing here knows what it is previewing — see ActivityPreview for a consumer.
export function HoverPreview({
	children,
	content,
	className,
	side = "right",
	align = "start",
	openDelay = 350,
	closeDelay = 100,
}: {
	children: ReactNode;
	content: () => ReactNode;
	className?: string;
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
	openDelay?: number;
	closeDelay?: number;
}) {
	const [open, setOpen] = useState(false);
	return (
		<HoverCard
			open={open}
			onOpenChange={setOpen}
			openDelay={openDelay}
			closeDelay={closeDelay}
		>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent
				side={side}
				align={align}
				className={cn("w-80 overflow-hidden p-0", className)}
			>
				{open ? content() : null}
			</HoverCardContent>
		</HoverCard>
	);
}
