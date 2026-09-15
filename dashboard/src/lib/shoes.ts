import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";

import { graphQLClient } from "@/graphql/client";

// Raw requests, hand-typed, so the generated types stay untouched. Lifetime
// mileage rides the shoes -> activities relationship: starting_km plus the
// summed distance of every activity logged in the shoe.
export interface Shoe {
	id: string | number;
	name: string;
	image_url: string | null;
	starting_km: number | string | null;
	activities_aggregate: {
		aggregate: {
			count: number;
			sum: { distance_m: number | string | null } | null;
		} | null;
	};
}

export interface ShoeInput {
	name: string;
	image_url: string | null;
	starting_km: number;
}

const SHOES = `
	query Shoes {
		shoes(order_by: { name: asc }) {
			id
			name
			image_url
			starting_km
			activities_aggregate {
				aggregate {
					count
					sum {
						distance_m
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
	const summed = Number(shoe.activities_aggregate.aggregate?.sum?.distance_m ?? 0);
	return start + summed / 1000;
}
