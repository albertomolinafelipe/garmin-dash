import { useEffect, useRef } from "react";

function isTyping(target: EventTarget | null): boolean {
	const node = target as HTMLElement | null;
	if (!node) return false;
	const tag = node.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		node.isContentEditable
	);
}

// Vim-style month navigation: j for the next month, k for the previous one,
// matching the direction of the up/down chevrons in the toolbar.
//
// Bound on the window so it works without the calendar holding focus, which
// means it has to stay out of the way of everything else: modifier
// combinations are left to the browser, keystrokes while typing are ignored so
// a 'j' in an entry title doesn't move the month out from under the dialog, and
// an open dialog keeps the keyboard entirely.
export function useMonthKeys(onStep: (direction: 1 | -1) => void) {
	// Held in a ref so a callback that closes over the current month doesn't
	// detach and reattach the listener on every render.
	const callback = useRef(onStep);
	callback.current = onStep;

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey) return;
			if (isTyping(event.target)) return;
			if (document.querySelector("[role=dialog][data-state=open]")) return;

			if (event.key === "j") callback.current(1);
			else if (event.key === "k") callback.current(-1);
			else return;

			event.preventDefault();
		};

		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, []);
}
