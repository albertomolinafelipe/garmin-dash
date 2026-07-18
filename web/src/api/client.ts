import axios from "axios";
import type {
	Activity,
	ActivityRoute,
	ActivityStreams,
	Annotation,
	Exercise,
	Sleep,
	SyncResult,
} from "./types";

const http = axios.create({ baseURL: "/api" });

export const api = {
	listActivities: (params?: {
		limit?: number;
		activity_type?: string;
		annotated?: boolean;
	}) => http.get<Activity[]>("/activities", { params }).then((r) => r.data),

	getActivity: (id: number) =>
		http.get<Activity>(`/activities/${id}`).then((r) => r.data),

	activityStreams: (id: number) =>
		http.get<ActivityStreams>(`/activities/${id}/streams`).then((r) => r.data),

	updateActivity: (id: number, body: Annotation) =>
		http.patch<Activity>(`/activities/${id}`, body).then((r) => r.data),

	foodOptions: () =>
		http.get<string[]>("/activities/food-options").then((r) => r.data),

	exercises: () => http.get<Exercise[]>("/exercises").then((r) => r.data),

	exercisesRaw: () =>
		http.get<{ text: string }>("/exercises/raw").then((r) => r.data.text),

	saveExercisesRaw: (text: string) =>
		http.put<Exercise[]>("/exercises/raw", { text }).then((r) => r.data),

	latestRunRoutes: (params?: { limit?: number }) =>
		http
			.get<ActivityRoute[]>("/activities/latest-run-routes", { params })
			.then((r) => r.data),

	listSleep: (params?: { limit?: number }) =>
		http.get<Sleep[]>("/sleep", { params }).then((r) => r.data),

	getSleep: (id: number) => http.get<Sleep>(`/sleep/${id}`).then((r) => r.data),

	sync: (params?: {
		days?: number;
		download_fits?: boolean;
		max_activities?: number; // 0 = unbounded (full history backfill)
	}) => http.post<SyncResult>("/sync", null, { params }).then((r) => r.data),
};
