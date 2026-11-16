export type Role = 'ceo' | 'dev';

export type VideoStatus =
  | 'uploaded'
  | 'scripting'
  | 'script_ready'
  | 'generating'
  | 'done'
  | 'failed';

export interface Profile {
  user_id: string;
  name: string | null;
  role: Role;
  created_at: string;
}

export interface Settings {
  id: 1;
  voice_id: string | null;
  tts_model: string; // default 'eleven_multilingual_v2'
  stability: number; // 0..1, default 0.40
  similarity: number; // 0..1, default 0.80
  speed_cap: number; // default 1.15
  words_per_sec: number; // default 2.2
  style_sample: string;
  glossary: string;
  updated_at: string;
}

export type SyncRowStatus = 'green' | 'yellow' | 'red';

export interface SyncRow {
  idx: number;
  start: number;
  available: number;
  audio: number;
  speed: number;
  overflow_sec: number;
  status: SyncRowStatus;
}

export interface Video {
  id: string;
  title: string;
  status: VideoStatus;
  drive_file_id: string;
  drive_link: string | null;
  duration_sec: number | null;
  summary: string | null;
  final_drive_file_id: string | null;
  final_drive_link: string | null;
  credits_estimate: number | null;
  credits_used: number | null;
  sync_report: SyncRow[] | string | null; // may arrive as a JSON string; parse defensively
  error: string | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Segment {
  id: string;
  video_id: string;
  idx: number;
  start_sec: number;
  end_sec: number;
  word_limit: number;
  bangla_text: string;
  english_text: string;
  check_note: string;
  audio_path: string | null;
  audio_text_hash: string | null;
  audio_duration_sec: number | null;
  updated_at: string;
}

/** Parses `video.sync_report`, which may arrive as a JSON string or already-parsed array. */
export function parseSyncReport(report: Video['sync_report']): SyncRow[] {
  if (!report) return [];
  if (typeof report === 'string') {
    try {
      const parsed = JSON.parse(report);
      return Array.isArray(parsed) ? (parsed as SyncRow[]) : [];
    } catch {
      return [];
    }
  }
  return report;
}
