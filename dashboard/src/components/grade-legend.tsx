import { GRADE_BANDS } from "@/lib/grade";
import { cn } from "@/lib/utils";

// Colour key for grade-coloured routes and profiles, flat to steep.
export function GradeLegend({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums",
				className,
			)}
		>
			{GRADE_BANDS.map((band) => (
				<span key={band.label} className="flex items-center gap-1">
					<span
						className="size-2 rounded-[2px]"
						style={{ backgroundColor: band.color }}
						aria-hidden
					/>
					{band.label}
				</span>
			))}
		</div>
	);
}
