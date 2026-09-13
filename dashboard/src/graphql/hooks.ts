import { useMutation, useQuery } from "@tanstack/react-query";
import { toActivitySetInput, type AnnotationInput } from "@/lib/annotations";
import { graphQLClient } from "./client";
import {
	ActivitiesSmokeDocument,
	ActivityDetailDocument,
	type GeneratedActivityDetailQueryVariables,
	CalendarActivitiesDocument,
	DeleteExerciseDocument,
	type GeneratedDeleteExerciseMutationVariables,
	ExercisesDocument,
	FoodOptionsDocument,
	InsertExerciseDocument,
	type GeneratedInsertExerciseMutationVariables,
	SportsDocument,
	DayPlansDocument,
	WeekNotesDocument,
	WeekObjectivesDocument,
	RacesDocument,
	InsertRaceDocument,
	type GeneratedInsertRaceMutationVariables,
	UpdateRaceDocument,
	type GeneratedUpdateRaceMutationVariables,
	DeleteRaceDocument,
	type GeneratedDeleteRaceMutationVariables,
	InsertDayPlanDocument,
	type GeneratedInsertDayPlanMutationVariables,
	UpdateDayPlanDocument,
	type GeneratedUpdateDayPlanMutationVariables,
	DeleteDayPlanDocument,
	type GeneratedDeleteDayPlanMutationVariables,
	UpsertWeekNoteDocument,
	type GeneratedUpsertWeekNoteMutationVariables,
	DeleteWeekNoteDocument,
	type GeneratedDeleteWeekNoteMutationVariables,
	InsertWeekObjectiveDocument,
	type GeneratedInsertWeekObjectiveMutationVariables,
	UpdateWeekObjectiveDocument,
	type GeneratedUpdateWeekObjectiveMutationVariables,
	DeleteWeekObjectiveDocument,
	type GeneratedDeleteWeekObjectiveMutationVariables,
	UpdateActivityDocument,
	UpdateExerciseDocument,
	type GeneratedUpdateExerciseMutationVariables,
} from "./generated";

export function useActivitiesSmokeQuery() {
	return useQuery({
		queryKey: ["ActivitiesSmoke"],
		queryFn: () => graphQLClient.request(ActivitiesSmokeDocument),
	});
}

export function useCalendarActivitiesQuery() {
	return useQuery({
		queryKey: ["activities"],
		queryFn: () => graphQLClient.request(CalendarActivitiesDocument),
	});
}

export function useActivityDetailQuery(id: string | undefined) {
	return useQuery({
		queryKey: ["activity", id],
		enabled: Boolean(id),
		queryFn: () =>
			graphQLClient.request(ActivityDetailDocument, {
				id,
			} as GeneratedActivityDetailQueryVariables),
		select: (data) => data.activities_by_pk,
	});
}

export interface UpdateActivityVariables {
	id: string;
	patch: AnnotationInput;
}

export function useUpdateActivityMutation() {
	return useMutation({
		mutationFn: ({ id, patch }: UpdateActivityVariables) =>
			graphQLClient.request(UpdateActivityDocument, {
				id,
				set: toActivitySetInput(patch),
			}),
	});
}

export function useFoodOptionsQuery() {
	return useQuery({
		queryKey: ["food-options"],
		queryFn: () => graphQLClient.request(FoodOptionsDocument),
	});
}

export function useExercisesQuery() {
	return useQuery({
		queryKey: ["exercises"],
		queryFn: () => graphQLClient.request(ExercisesDocument),
	});
}

export function useInsertExerciseMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedInsertExerciseMutationVariables) =>
			graphQLClient.request(InsertExerciseDocument, variables),
	});
}

export function useUpdateExerciseMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedUpdateExerciseMutationVariables) =>
			graphQLClient.request(UpdateExerciseDocument, variables),
	});
}

export function useDeleteExerciseMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedDeleteExerciseMutationVariables) =>
			graphQLClient.request(DeleteExerciseDocument, variables),
	});
}

export function useSportsQuery() {
	return useQuery({
		queryKey: ["sports"],
		queryFn: () => graphQLClient.request(SportsDocument),
		select: (data) => data.sports,
	});
}

export function useRacesQuery() {
	return useQuery({
		queryKey: ["races"],
		queryFn: () => graphQLClient.request(RacesDocument),
		select: (data) => data.races,
	});
}

export function useInsertRaceMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedInsertRaceMutationVariables) =>
			graphQLClient.request(InsertRaceDocument, variables),
	});
}

export function useUpdateRaceMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedUpdateRaceMutationVariables) =>
			graphQLClient.request(UpdateRaceDocument, variables),
	});
}

export function useDeleteRaceMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedDeleteRaceMutationVariables) =>
			graphQLClient.request(DeleteRaceDocument, variables),
	});
}

export function useDayPlansQuery() {
	return useQuery({
		queryKey: ["day-plans"],
		queryFn: () => graphQLClient.request(DayPlansDocument),
		select: (data) => data.day_plans,
	});
}

export function useInsertDayPlanMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedInsertDayPlanMutationVariables) =>
			graphQLClient.request(InsertDayPlanDocument, variables),
	});
}

export function useUpdateDayPlanMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedUpdateDayPlanMutationVariables) =>
			graphQLClient.request(UpdateDayPlanDocument, variables),
	});
}

export function useDeleteDayPlanMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedDeleteDayPlanMutationVariables) =>
			graphQLClient.request(DeleteDayPlanDocument, variables),
	});
}

export function useWeekNotesQuery() {
	return useQuery({
		queryKey: ["week-notes"],
		queryFn: () => graphQLClient.request(WeekNotesDocument),
		select: (data) => data.week_notes,
	});
}

export function useUpsertWeekNoteMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedUpsertWeekNoteMutationVariables) =>
			graphQLClient.request(UpsertWeekNoteDocument, variables),
	});
}

export function useDeleteWeekNoteMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedDeleteWeekNoteMutationVariables) =>
			graphQLClient.request(DeleteWeekNoteDocument, variables),
	});
}

export function useWeekObjectivesQuery() {
	return useQuery({
		queryKey: ["week-objectives"],
		queryFn: () => graphQLClient.request(WeekObjectivesDocument),
		select: (data) => data.week_objectives,
	});
}

export function useInsertWeekObjectiveMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedInsertWeekObjectiveMutationVariables) =>
			graphQLClient.request(InsertWeekObjectiveDocument, variables),
	});
}

export function useUpdateWeekObjectiveMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedUpdateWeekObjectiveMutationVariables) =>
			graphQLClient.request(UpdateWeekObjectiveDocument, variables),
	});
}

export function useDeleteWeekObjectiveMutation() {
	return useMutation({
		mutationFn: (variables: GeneratedDeleteWeekObjectiveMutationVariables) =>
			graphQLClient.request(DeleteWeekObjectiveDocument, variables),
	});
}
