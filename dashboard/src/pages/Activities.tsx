import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { LayoutGrid, List, Search, X } from "lucide-react";

import {
	type ActivityFilters,
	countActiveFilters,
	emptyFilters,
	filterActivities,
	filtersFromParams,
	filtersToParams,
	type Range,
	type ViewMode,
} from "@/components/activities/filters";
import { ActivityCards, ActivityTable } from "@/components/activities/views";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
	type Category,
	CATEGORY_ORDER,
	categoryColor,
	categoryIcon,
} from "@/lib/activity-types";
import { useActivities, useRacesByDay } from "@/lib/queries";
import { cn } from "@/lib/utils";

// The slider bounds are deliberately fixed rather than data-derived, so the
// scale doesn't shift as activities are synced. Sitting at an end means "no
// bound", which keeps a full-width slider from filtering anything out.
function RangeSlider({
	label,
	unit,
	max,
	step,
	value,
	onChange,
}: {
	label: string;
	unit: string;
	max: number;
	step: number;
	value: Range;
	onChange: (range: Range) => void;
}) {
	const low = value.min ?? 0;
	const high = value.max ?? max;
	return (
		<div className="grid min-w-44 flex-1 gap-1.5">
			<div className="flex items-baseline justify-between">
				<Label className="text-xs">{label}</Label>
				<span className="text-muted-foreground text-xs tabular-nums">
					{low}–{high >= max ? `${max}+` : high} {unit}
				</span>
			</div>
			<Slider
				min={0}
				max={max}
				step={step}
				value={[low, high]}
				onValueChange={([nextLow, nextHigh]) =>
					onChange({
						min: nextLow === 0 ? null : nextLow,
						max: nextHigh >= max ? null : nextHigh,
					})
				}
			/>
		</div>
	);
}

function CategoryChips({
	selected,
	onChange,
}: {
	selected: Category[];
	onChange: (categories: Category[]) => void;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{CATEGORY_ORDER.map((category) => {
				const Icon = categoryIcon[category];
				const active = selected.includes(category);
				return (
					<button
						key={category}
						type="button"
						aria-pressed={active}
						onClick={() =>
							onChange(
								active
									? selected.filter((c) => c !== category)
									: [...selected, category],
							)
						}
						className={cn(
							"flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
							active
								? "border-transparent text-background"
								: "text-muted-foreground hover:bg-muted",
						)}
						style={active ? { backgroundColor: categoryColor[category] } : undefined}
					>
						<Icon
							size={13}
							style={active ? undefined : { color: categoryColor[category] }}
						/>
						{category}
					</button>
				);
			})}
		</div>
	);
}

export function Activities() {
	const { data, isPending } = useActivities();
	const racesByDay = useRacesByDay();
	const [params, setParams] = useSearchParams();
	const { filters, view, page } = useMemo(
		() => filtersFromParams(params),
		[params],
	);
	// Replace rather than push: dragging a slider shouldn't fill up history, but
	// the entry is still there when a detail page navigates back.
	const update = (
		next: Partial<ActivityFilters>,
		nextView = view,
		nextPage = page,
	) =>
		setParams(filtersToParams({ ...filters, ...next }, nextView, nextPage), {
			replace: true,
		});
	const setView = (nextView: ViewMode) => update({}, nextView, 0);
	const setPage = (nextPage: number) => update({}, view, nextPage);
	const activities = useMemo(() => data?.activities ?? [], [data]);

	const filtered = useMemo(
		() => filterActivities(activities, filters),
		[activities, filters],
	);
	const activeFilters = countActiveFilters(filters);

	const patch = (next: Partial<ActivityFilters>) => update(next, view, 0);

	return (
		<div className="flex h-full min-h-0 flex-col gap-4 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
					<p className="text-muted-foreground text-sm">
						{filtered.length} of {activities.length} activities
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="relative w-full sm:w-80">
						<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
						<Input
							value={filters.search}
							onChange={(event) => patch({ search: event.currentTarget.value })}
							placeholder="Search name, type or place…"
							aria-label="Search activities"
							className="pl-9"
						/>
					</div>
					<ToggleGroup
						type="single"
						value={view}
						onValueChange={(next) => next && setView(next as ViewMode)}
						variant="outline"
					>
						<ToggleGroupItem value="list" aria-label="List view">
							<List className="size-4" />
						</ToggleGroupItem>
						<ToggleGroupItem value="cards" aria-label="Card view">
							<LayoutGrid className="size-4" />
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			<div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border p-3">
				<div className="grid gap-1.5">
					<Label className="text-xs">Date range</Label>
					<DateRangePicker
						from={filters.from}
						to={filters.to}
						onChange={({ from, to }) => patch({ from, to })}
					/>
				</div>
				<div className="grid gap-1.5">
					<Label className="text-xs">Sports</Label>
					<CategoryChips
						selected={filters.categories}
						onChange={(categories) => patch({ categories })}
					/>
				</div>
				<RangeSlider
					label="Distance"
					unit="km"
					max={80}
					step={1}
					value={filters.distanceKm}
					onChange={(distanceKm) => patch({ distanceKm })}
				/>
				<RangeSlider
					label="Duration"
					unit="h"
					max={24}
					step={0.5}
					value={filters.durationH}
					onChange={(durationH) => patch({ durationH })}
				/>
				<RangeSlider
					label="Elevation"
					unit="m"
					max={5000}
					step={50}
					value={filters.elevationM}
					onChange={(elevationM) => patch({ elevationM })}
				/>
				<Button
					variant="ghost"
					size="sm"
					disabled={activeFilters === 0}
					onClick={() => patch({ ...emptyFilters, search: filters.search })}
				>
					<X className="size-4" />
					Clear
					{activeFilters > 0 ? (
						<Badge variant="secondary" className="tabular-nums">
							{activeFilters}
						</Badge>
					) : null}
				</Button>
			</div>

			<Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
				<CardContent className="h-full overflow-auto px-0">
					{view === "list" ? (
						<ActivityTable activities={filtered} racesByDay={racesByDay} />
					) : null}
					{view === "cards" ? (
						<ActivityCards
							activities={filtered}
							racesByDay={racesByDay}
							page={page}
							onPageChange={setPage}
						/>
					) : null}

					{isPending && (
						<div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
							Loading activities…
						</div>
					)}
					{!isPending && filtered.length === 0 && (
						<div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
							{activities.length === 0
								? "No activities synced yet."
								: "No activities match your filters."}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
