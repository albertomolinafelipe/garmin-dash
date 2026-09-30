import { describe, expect, it } from "vitest";

import {
	indexJournalEntries,
	type JournalEntry,
} from "@/components/calendar/model";
import { entryLengthDays, formatRange } from "@/lib/journal";

function entry(e: Partial<JournalEntry>): JournalEntry {
	return {
		id: 1,
		kind: "trip",
		start_date: "2026-09-10",
		end_date: null,
		title: "Test",
		note: null,
		severity: null,
		...e,
	};
}

const daysCovered = (map: Map<string, JournalEntry[]>) =>
	[...map.keys()].sort();

describe("indexJournalEntries", () => {
	const today = new Date(2026, 8, 20); // 2026-09-20, local

	it("covers a single day when start and end match", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-09-10", end_date: "2026-09-10" })],
			today,
		);
		expect(daysCovered(map)).toEqual(["2026-09-10"]);
	});

	it("covers every day of a closed range, inclusive of both ends", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-09-10", end_date: "2026-09-13" })],
			today,
		);
		expect(daysCovered(map)).toEqual([
			"2026-09-10",
			"2026-09-11",
			"2026-09-12",
			"2026-09-13",
		]);
	});

	it("runs an open-ended entry up to today and no further", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-09-18", end_date: null })],
			today,
		);
		expect(daysCovered(map)).toEqual([
			"2026-09-18",
			"2026-09-19",
			"2026-09-20",
		]);
	});

	it("keeps a future open-ended entry on its start day only", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-10-05", end_date: null })],
			today,
		);
		expect(daysCovered(map)).toEqual(["2026-10-05"]);
	});

	it("crosses month boundaries", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-08-30", end_date: "2026-09-02" })],
			today,
		);
		expect(daysCovered(map)).toEqual([
			"2026-08-30",
			"2026-08-31",
			"2026-09-01",
			"2026-09-02",
		]);
	});

	it("stacks overlapping entries on the days they share", () => {
		const map = indexJournalEntries(
			[
				entry({ id: 1, start_date: "2026-09-10", end_date: "2026-09-13" }),
				entry({
					id: 2,
					kind: "illness",
					start_date: "2026-09-12",
					end_date: "2026-09-14",
				}),
			],
			today,
		);
		expect(map.get("2026-09-11")).toHaveLength(1);
		expect(map.get("2026-09-12")).toHaveLength(2);
		expect(map.get("2026-09-14")).toHaveLength(1);
	});

	it("falls back to the start day when the range is inverted", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-09-13", end_date: "2026-09-10" })],
			today,
		);
		expect(daysCovered(map)).toEqual(["2026-09-13"]);
	});

	it("ignores an unparseable start date", () => {
		const map = indexJournalEntries([entry({ start_date: "nonsense" })], today);
		expect(map.size).toBe(0);
	});

	// A range spanning a DST transition still advances one calendar day at a
	// time; local midnights, not fixed 24h offsets.
	it("advances by calendar days across a DST boundary", () => {
		const map = indexJournalEntries(
			[entry({ start_date: "2026-10-24", end_date: "2026-10-27" })],
			new Date(2026, 9, 28),
		);
		expect(daysCovered(map)).toEqual([
			"2026-10-24",
			"2026-10-25",
			"2026-10-26",
			"2026-10-27",
		]);
	});
});

describe("formatRange / entryLengthDays", () => {
	it("marks an open entry as ongoing", () => {
		expect(formatRange(entry({ end_date: null }))).toMatch(/^Since /);
		expect(entryLengthDays(entry({ end_date: null }))).toBeNull();
	});

	it("counts a closed range inclusively", () => {
		expect(
			entryLengthDays(
				entry({ start_date: "2026-09-10", end_date: "2026-09-13" }),
			),
		).toBe(4);
		expect(
			entryLengthDays(
				entry({ start_date: "2026-09-10", end_date: "2026-09-10" }),
			),
		).toBe(1);
	});

	it("shows a single day once rather than as a range", () => {
		const label = formatRange(
			entry({ start_date: "2026-09-10", end_date: "2026-09-10" }),
		);
		expect(label).not.toContain("–");
	});
});
