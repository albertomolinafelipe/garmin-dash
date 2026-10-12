import { useEffect, useId, useReducer, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useExercisesQuery } from "@/graphql/hooks";
import { SCALE_OPTIONS } from "@/lib/activity-types";
import {
	parseStrengthExercises,
	type AnnotationInput,
	type StrengthEntry,
} from "@/lib/annotations";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Field, SegmentedField } from "./fields";
import { strengthRowsReducer, type StrengthRowsAction } from "./strength-rows";

export interface StrengthActivity {
	id: unknown;
	feeling: number | null;
	effort: number | null;
	strength_exercises: unknown;
}
interface Props {
	activity: StrengthActivity;
	onSave: (patch: AnnotationInput) => unknown;
	foodOptions?: string[];
}

const MAX_SUGGESTIONS = 8;

function rankSuggestions(names: string[], query: string): string[] {
	const q = query.trim().toLowerCase();
	if (!q) return names.slice(0, MAX_SUGGESTIONS);
	const starts: string[] = [];
	const contains: string[] = [];
	for (const name of names) {
		const n = name.toLowerCase();
		if (n.startsWith(q)) starts.push(name);
		else if (n.includes(q)) contains.push(name);
	}
	return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

interface ExerciseInputProps {
	value: string;
	options: string[];
	ariaLabel: string;
	inputRef?: (el: HTMLInputElement | null) => void;
	onChange: (value: string) => void;
	onCommit: (value: string) => void;
}

// Inline combobox: typing filters suggestions, arrows move, Enter/Tab accept
// the highlighted one, Escape keeps exactly what was typed.
function ExerciseInput({
	value,
	options,
	ariaLabel,
	inputRef,
	onChange,
	onCommit,
}: ExerciseInputProps) {
	const listId = useId();
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const suggestions = rankSuggestions(options, value).filter(
		(name) => name !== value,
	);
	const visible = open && suggestions.length > 0;
	const highlighted = visible && active >= 0 ? suggestions[active] : undefined;

	const pick = (name: string) => {
		onChange(name);
		setOpen(false);
		setActive(-1);
	};

	return (
		<div className="relative">
			<Input
				ref={inputRef}
				role="combobox"
				aria-label={ariaLabel}
				aria-expanded={visible}
				aria-controls={listId}
				aria-autocomplete="list"
				autoComplete="off"
				value={value}
				placeholder="Exercise"
				onFocus={() => setOpen(true)}
				onChange={(event) => {
					onChange(event.target.value);
					setOpen(true);
					// Pre-highlight the best match only once something is typed.
					setActive(event.target.value.trim() ? 0 : -1);
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setOpen(true);
						setActive((i) => Math.min(i + 1, suggestions.length - 1));
					} else if (event.key === "ArrowUp") {
						event.preventDefault();
						setActive((i) => Math.max(i - 1, -1));
					} else if (event.key === "Escape" && visible) {
						event.preventDefault();
						event.stopPropagation();
						setOpen(false);
						setActive(-1);
					} else if (event.key === "Enter") {
						event.preventDefault();
						if (highlighted) pick(highlighted);
					} else if (event.key === "Tab" && !event.shiftKey && highlighted) {
						// Accept and let focus move on to Sets.
						pick(highlighted);
					}
				}}
				onBlur={(event) => {
					setOpen(false);
					setActive(-1);
					onCommit(event.currentTarget.value);
				}}
			/>
			{visible && (
				<ul
					id={listId}
					role="listbox"
					className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 max-h-64 w-full min-w-48 overflow-auto rounded-md border p-1 shadow-md"
				>
					{suggestions.map((name, i) => (
						<li
							key={name}
							role="option"
							aria-selected={i === active}
							className={cn(
								"cursor-pointer rounded-sm px-2 py-1.5 text-sm",
								i === active && "bg-accent text-accent-foreground",
							)}
							// mousedown keeps focus in the input so blur doesn't race the pick.
							onMouseDown={(event) => {
								event.preventDefault();
								pick(name);
							}}
							onMouseEnter={() => setActive(i)}
						>
							{name}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export function StrengthAnnotation({ activity, onSave }: Props) {
	const [rows, dispatch] = useReducer(
		strengthRowsReducer,
		activity.strength_exercises,
		parseStrengthExercises,
	);
	const dirty = useRef(false);
	const activityId = useRef(activity.id);
	// Saves read from this ref: a Tab right after an edit blurs before re-render.
	const latest = useRef(rows);
	latest.current = rows;
	const exerciseInputs = useRef<(HTMLInputElement | null)[]>([]);
	const focusRow = useRef<number | null>(null);
	useEffect(() => {
		if (focusRow.current === null) return;
		exerciseInputs.current[focusRow.current]?.focus();
		focusRow.current = null;
	});
	const exerciseNames = (useExercisesQuery().data?.exercises ?? []).map(
		(exercise) => exercise.name,
	);
	const apply = (action: StrengthRowsAction) => {
		latest.current = strengthRowsReducer(latest.current, action);
		dispatch(action);
	};
	useEffect(() => {
		if (activityId.current !== activity.id) {
			activityId.current = activity.id;
			dirty.current = false;
			dispatch({ type: "reset", value: activity.strength_exercises });
		} else if (!dirty.current)
			dispatch({ type: "reset", value: activity.strength_exercises });
	}, [activity.id, activity.strength_exercises]);
	const save = async () => {
		const ok = await onSave({ strength_exercises: latest.current });
		if (ok !== false) dirty.current = false;
	};
	const edit = (
		index: number,
		field: keyof StrengthEntry,
		value: string | number | null,
	) => {
		dirty.current = true;
		apply({ type: "edit", index, field, value });
	};
	const addRow = () => {
		dirty.current = true;
		apply({ type: "add" });
		focusRow.current = latest.current.length - 1;
		void save();
	};
	const scale = (
		label: string,
		field: "feeling" | "effort",
		value: number | null,
	) => (
		<SegmentedField
			label={label}
			value={value?.toString() ?? ""}
			onChange={(next) => {
				if (next) void onSave({ [field]: Number(next) });
			}}
			options={SCALE_OPTIONS.map((option) => ({
				value: option.value,
				label: option.label,
				ariaLabel: `${label} ${option.label}`,
			}))}
		/>
	);
	return (
		<div className="space-y-4">
			<div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
				{scale("Feel", "feeling", activity.feeling)}
				{scale("Intensity", "effort", activity.effort)}
			</div>
			<Field label="Exercises" hint="Weight blank = bodyweight.">
				<div className="space-y-3">
					{rows.length > 0 && (
						<div className="text-muted-foreground hidden grid-cols-[minmax(10rem,2fr)_1fr_1fr_1fr_auto] gap-2 px-1 text-xs font-medium sm:grid">
							<span>Exercise</span>
							<span>Sets</span>
							<span>Reps</span>
							<span>Weight</span>
							<span className="w-9" />
						</div>
					)}
					{rows.map((row, index) => (
						<div
							key={index}
							className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(10rem,2fr)_1fr_1fr_1fr_auto]"
						>
							<ExerciseInput
								ariaLabel={`Exercise ${index + 1}`}
								value={row.exercise}
								options={exerciseNames}
								inputRef={(el) => {
									exerciseInputs.current[index] = el;
								}}
								onChange={(value) => edit(index, "exercise", value)}
								onCommit={() => void save()}
							/>
							{(["sets", "reps", "weight"] as const).map((field) => (
								<NumberInput
									key={field}
									aria-label={`${field} ${index + 1}`}
									placeholder={field}
									integer={field !== "weight"}
									nonNegative
									value={row[field]}
									onChange={(value) => edit(index, field, value)}
									onBlur={() => void save()}
									onKeyDown={(event) => {
										if (event.key === "Enter" && index === rows.length - 1) {
											event.preventDefault();
											addRow();
										}
									}}
								/>
							))}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={`Remove exercise ${index + 1}`}
								onClick={() => {
									dirty.current = true;
									apply({ type: "remove", index });
									void save();
								}}
							>
								<Trash2 />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addRow}
					>
						<Plus /> Add exercise
					</Button>
				</div>
			</Field>
		</div>
	);
}
