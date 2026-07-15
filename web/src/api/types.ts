export interface Activity {
  id: number;
  garmin_activity_id: number;
  name: string | null;
  activity_type: string | null;
  start_time: string | null;
  duration_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  calories: number | null;
  avg_speed_mps: number | null;
  avg_power_w: number | null;
  fit_path: string | null;
  synced_at: string | null;
  // annotations
  annotated: boolean;
  subtype: string | null;
  feeling: number | null;
  effort: number | null;
  food_during: string[] | null;
  food_after: string[] | null;
  caffeine: string | null;
  weather: string | null;
  notes: string | null;
  focus: string | null;
  hard_tries: number | null;
}

export interface Sleep {
  id: number;
  calendar_date: string;
  start_time: string | null;
  end_time: string | null;
  total_sleep_s: number | null;
  deep_sleep_s: number | null;
  light_sleep_s: number | null;
  rem_sleep_s: number | null;
  awake_s: number | null;
  avg_hrv: number | null;
  resting_hr: number | null;
  sleep_score: number | null;
  synced_at: string | null;
  // no user annotation fields yet
}

export interface Annotation {
  name?: string | null;
  annotated?: boolean | null;
  subtype?: string | null;
  feeling?: number | null;
  effort?: number | null;
  food_during?: string[] | null;
  food_after?: string[] | null;
  caffeine?: string | null;
  weather?: string | null;
  notes?: string | null;
  focus?: string | null;
  hard_tries?: number | null;
}

export interface SyncResult {
  activities_created: number;
  activities_updated: number;
  sleep_created: number;
  sleep_updated: number;
  errors: string[];
}
