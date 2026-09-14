import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { categoryColor } from "@/lib/activity-types";
import type { StreamSample } from "@/lib/queries";

const GRADIENT_ID = "preview-elevation";

// Bare elevation profile for the hover preview: no axes, grid, labels or
// tooltip. It reads as a shape, not a chart, so it sits flush against the
// card's edges.
export function ElevationSparkline({
	elevation,
	className,
}: {
	elevation: StreamSample[];
	className?: string;
}) {
	const color = categoryColor.running;
	return (
		<div className={className}>
			<ResponsiveContainer width="100%" height="100%">
				{/* Only the top gets a margin: at the peak the stroke is centred on the
				    plot edge, so half of it would be clipped. Sides and bottom stay at 0
				    to keep the profile flush with the card. */}
				<AreaChart
					data={elevation}
					margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
				>
					<defs>
						<linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={color} stopOpacity={0.55} />
							<stop offset="100%" stopColor={color} stopOpacity={0.05} />
						</linearGradient>
					</defs>
					{/* Scale x by elapsed time rather than sample index: samples are
					    bucketed by count, so an index axis distorts the profile wherever
					    recording density varies. */}
					<XAxis
						hide
						type="number"
						dataKey="t"
						domain={["dataMin", "dataMax"]}
					/>
					{/* Domain hugs the real min/max so rolling terrain still shows relief. */}
					<YAxis hide domain={["dataMin", "dataMax"]} />
					<Area
						type="monotone"
						dataKey="v"
						stroke={color}
						strokeWidth={1.5}
						fill={`url(#${GRADIENT_ID})`}
						isAnimationActive={false}
						dot={false}
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
