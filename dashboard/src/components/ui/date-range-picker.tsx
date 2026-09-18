import { format } from "date-fns";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { iconifyIcon } from "@/lib/activity-types";
import { dayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const CalendarIcon = iconifyIcon("mdi:calendar");

const toDate = (value: string) =>
	value ? new Date(`${value}T00:00:00`) : undefined;

export function DateRangePicker({
	from,
	to,
	onChange,
	id,
	placeholder = "Any date",
	className,
}: {
	from: string;
	to: string;
	onChange: (range: { from: string; to: string }) => void;
	id?: string;
	placeholder?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected: DateRange | undefined = from
		? { from: toDate(from), to: toDate(to) }
		: undefined;

	const label = from
		? `${format(toDate(from) as Date, "d MMM yyyy")} – ${
				to ? format(toDate(to) as Date, "d MMM yyyy") : "…"
			}`
		: placeholder;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					className={cn(
						"justify-start font-normal",
						!from && "text-muted-foreground",
						className,
					)}
				>
					<CalendarIcon size={16} />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="range"
					numberOfMonths={2}
					defaultMonth={toDate(from)}
					selected={selected}
					onSelect={(range) =>
						onChange({
							from: range?.from ? dayKey(range.from) : "",
							to: range?.to ? dayKey(range.to) : "",
						})
					}
				/>
			</PopoverContent>
		</Popover>
	);
}
