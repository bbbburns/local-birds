export interface Env {
  DB: D1Database;
  EBIRD_API_KEY: string;
  POLL_SECRET: string;
}

export interface Sighting {
  id: number;
  obs_date: string;
  species_code: string;
  common_name: string;
  sci_name: string;
  location_name: string | null;
  how_many: number | null;
  obs_valid: number;
  obs_reviewed: number;
  sub_id: string | null;
  notable: number;
  thumbnail_url: string | null; // joined from species table
}

export interface PollStatus {
  id: number;
  polled_at: string;
  success: number;
  count: number;
}

export interface WeekCell {
  date: string; // ISO date string YYYY-MM-DD
  hasData: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekGrid {
  cells: WeekCell[];
  prevAnchor: string; // ISO date string
  nextAnchor: string; // ISO date string
  canGoPrev: boolean;
  canGoNext: boolean;
  label: string; // e.g. "April 2026" or "Mar – Apr 2026"
}
