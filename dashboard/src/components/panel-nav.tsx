import { ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// The back / forward / jump-to-latest control shared by the overview panels.
// `unit` only names the step in the accessible labels, e.g. "day" or "month".
export function PanelNav({
	unit,
	canForward,
	back,
	forward,
	latest,
}: {
	unit: string;
	canForward: boolean;
	back: () => void;
	forward: () => void;
	latest: () => void;
}) {
	return (
		<div className="text-muted-foreground flex items-center gap-1 text-xs">
			<Button
				variant="ghost"
				size="icon"
				className="size-6"
				onClick={back}
				aria-label={`Go back one ${unit}`}
			>
				<ChevronLeft className="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="size-6"
				onClick={forward}
				disabled={!canForward}
				aria-label={`Go forward one ${unit}`}
			>
				<ChevronRight className="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="size-6"
				onClick={latest}
				disabled={!canForward}
				aria-label="Jump to latest"
			>
				<ChevronsRight className="size-4" />
			</Button>
		</div>
	);
}
