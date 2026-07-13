import axios from "axios";
import type { Activity, Annotation, Sleep, SyncResult } from "./types";

const http = axios.create({ baseURL: "/api" });

export const api = {
  listActivities: (params?: {
    limit?: number;
    activity_type?: string;
    annotated?: boolean;
  }) => http.get<Activity[]>("/activities", { params }).then((r) => r.data),

  getActivity: (id: number) =>
    http.get<Activity>(`/activities/${id}`).then((r) => r.data),

  updateActivity: (id: number, body: Annotation) =>
    http.patch<Activity>(`/activities/${id}`, body).then((r) => r.data),

  foodOptions: () =>
    http.get<string[]>("/activities/food-options").then((r) => r.data),

  listSleep: (params?: { limit?: number }) =>
    http.get<Sleep[]>("/sleep", { params }).then((r) => r.data),

  getSleep: (id: number) =>
    http.get<Sleep>(`/sleep/${id}`).then((r) => r.data),

  sync: (params?: { days?: number; download_fits?: boolean }) =>
    http.post<SyncResult>("/sync", null, { params }).then((r) => r.data),
};
