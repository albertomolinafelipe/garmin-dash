import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useUpdateDayPlanMutation } from "@/graphql/hooks";
import { dayKey } from "@/lib/format";
import type { DayPlan } from "./model";

// Dragging a day-plan chip onto another day moves it to that date. Shared via
// context so the drop targets (page-owned day cells) and the drag source
// (DayPlanChip) coordinate without prop drilling.
interface DayPlanDndValue {
	onDragStartDayPlan: (p: DayPlan, e: React.DragEvent) => void;
	onDropDay: (day: Date, e: React.DragEvent) => void;
}

const DayPlanDndContext = createContext<DayPlanDndValue | null>(null);

export function DayPlanDndProvider({ children }: { children: ReactNode }) {
	const dragged = useRef<DayPlan | null>(null);
	const update = useUpdateDayPlanMutation();
	const queryClient = useQueryClient();

	const onDragStartDayPlan = useCallback((p: DayPlan, e: React.DragEvent) => {
		dragged.current = p;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", String(p.id));
	}, []);

	const onDropDay = useCallback(
		(day: Date, e: React.DragEvent) => {
			e.preventDefault();
			const p = dragged.current;
			dragged.current = null;
			if (!p) return;
			const date = dayKey(day);
			if (p.date === date) return;
			void (async () => {
				try {
					await update.mutateAsync({ id: p.id, set: { date } });
					await queryClient.invalidateQueries({ queryKey: ["day-plans"] });
				} catch {
					toast.error("Could not move the plan");
				}
			})();
		},
		[update, queryClient],
	);

	const value = useMemo(
		() => ({ onDragStartDayPlan, onDropDay }),
		[onDragStartDayPlan, onDropDay],
	);
	return (
		<DayPlanDndContext.Provider value={value}>
			{children}
		</DayPlanDndContext.Provider>
	);
}

export function useDayPlanDnd(): DayPlanDndValue | null {
	return useContext(DayPlanDndContext);
}

// Plain helpers (not hooks) so they can be used inside `.map` day loops.
export function dayDropProps(dnd: DayPlanDndValue | null, day: Date) {
	if (!dnd) return {};
	return {
		onDragOver: (e: React.DragEvent) => e.preventDefault(),
		onDrop: (e: React.DragEvent) => dnd.onDropDay(day, e),
	};
}

export function dayPlanDragProps(dnd: DayPlanDndValue | null, p: DayPlan) {
	if (!dnd) return {};
	return {
		draggable: true,
		onDragStart: (e: React.DragEvent) => dnd.onDragStartDayPlan(p, e),
	};
}
