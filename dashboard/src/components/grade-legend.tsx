import { GRADE_BANDS } from "@/lib/grade";
import { cn } from "@/lib/utils";

// Colour key for grade-coloured routes and profiles, flat to steep.
export function GradeLegend({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums",
				className,
			)}
		>
			{GRADE_BANDS.map((band) => (
				<span key={band.label} className="flex items-center gap-1">
					<span
						className="h-1.5 w-3 rounded-full"
						style={{ backgroundColor: band.color }}
						aria-hidden
					/>
					{band.label}
				</span>
			))}
		</div>
	);
}
