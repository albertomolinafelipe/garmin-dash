import {
	useMutation,
	useQuery,
	type UseQueryResult,
} from "@tanstack/react-query";

import { graphQLClient } from "@/graphql/client";

// Raw requests, hand-typed, so the generated types stay untouched. Lifetime
// usage rides the shoes -> activities relationship: starting_km plus the
// summed distance and duration of every activity logged in the shoe.
export interface Shoe {
	id: string | number;
	name: string;
	image_url: string | null;
	starting_km: number | string | null;
	sport: ShoeSport;
	// Retired: kept for history, demoted in pickers.
	archived: boolean;
	activities_aggregate: {
		aggregate: {
			count: number;
			sum: {
				distance_m: number | string | null;
				duration_s: number | string | null;
			} | null;
		} | null;
	};
}

export interface ShoeInput {
	name: string;
	image_url: string | null;
	starting_km: number;
	sport: ShoeSport;
	archived?: boolean;
}

// shoes.sport references public.sports; these are the sports gear is bought for.
// Hiking activities borrow running shoes, so it has no group of its own.
export type ShoeSport = "running" | "climbing" | "skiing";
export const SHOE_SPORTS: readonly ShoeSport[] = ["running", "climbing", "skiing"];

// Which shoe group an activity category draws from, if any.
export function shoeSportFor(category: string): ShoeSport | null {
	if (category === "hiking") return "running";
	return (SHOE_SPORTS as readonly string[]).includes(category)
		? (category as ShoeSport)
		: null;
}

// Climbing shoes carry no distance, so their wear is tracked in hours.
export function wearsByDistance(sport: ShoeSport): boolean {
	return sport !== "climbing";
}

const SHOES = `
	query Shoes {
		shoes(order_by: { name: asc }) {
			id
			name
			image_url
			starting_km
			sport
			archived
			activities_aggregate {
				aggregate {
					count
					sum {
						distance_m
						duration_s
					}
				}
			}
		}
	}
`;

const INSERT_SHOE = `
	mutation InsertShoe($object: shoes_insert_input!) {
		insert_shoes_one(object: $object) {
			id
		}
	}
`;

const UPDATE_SHOE = `
	mutation UpdateShoe($id: bigint!, $set: shoes_set_input!) {
		update_shoes_by_pk(pk_columns: { id: $id }, _set: $set) {
			id
		}
	}
`;

const DELETE_SHOE = `
	mutation DeleteShoe($id: bigint!) {
		delete_shoes_by_pk(id: $id) {
			id
		}
	}
`;

export function useShoes(): UseQueryResult<{ shoes: Shoe[] }, Error> {
	return useQuery({
		queryKey: ["shoes"],
		queryFn: () => graphQLClient.request<{ shoes: Shoe[] }>(SHOES),
	});
}

export function useInsertShoe() {
	return useMutation({
		mutationFn: (object: ShoeInput) =>
			graphQLClient.request(INSERT_SHOE, { object }),
	});
}

export function useUpdateShoe() {
	return useMutation({
		mutationFn: (variables: { id: unknown; set: Partial<ShoeInput> }) =>
			graphQLClient.request(UPDATE_SHOE, variables),
	});
}

export function useDeleteShoe() {
	return useMutation({
		mutationFn: (id: unknown) => graphQLClient.request(DELETE_SHOE, { id }),
	});
}

// starting_km plus summed activity distance, in km.
export function lifetimeKm(shoe: Shoe): number {
	const start = Number(shoe.starting_km ?? 0);
	const summed = Number(
		shoe.activities_aggregate.aggregate?.sum?.distance_m ?? 0,
	);
	return start + summed / 1000;
}

// Summed activity duration, in hours. Climbing sessions carry no distance, so
// time is the only wear signal for those shoes.
export function lifetimeHours(shoe: Shoe): number {
	const summed = Number(
		shoe.activities_aggregate.aggregate?.sum?.duration_s ?? 0,
	);
	return summed / 3600;
}
