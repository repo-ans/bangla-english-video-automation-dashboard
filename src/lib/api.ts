import type { Profile, Role, Segment, Settings, Video } from '../types';
import { isDemoMode } from './supabase';
import { supabaseApi } from './supabaseApi';
import { demoApi } from './demoApi';

export interface AuthUser {
  id: string;
  email: string;
}

export interface UploadHandle {
  promise: Promise<{ id: string }>;
  abort: () => void;
}

export interface VideoUploadedRequest {
  driveFileId: string;
  title: string;
  durationSec: number | null;
}

/**
 * All data access the app needs, implemented once against real Supabase + n8n
 * (`supabaseApi`) and once against in-memory sample data (`demoApi`). Everything
 * else in the app only talks to the `api` instance exported below.
 */
export interface Api {
  // Auth
  getSession(): Promise<AuthUser | null>;
  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithMagicLink(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;

  // Profile
  getProfile(userId: string): Promise<Profile | null>;
  getUploaderName(userId: string | null): Promise<string | null>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  // Videos & segments
  listVideos(): Promise<Video[]>;
  getVideo(id: string): Promise<Video | null>;
  getSegments(videoId: string): Promise<Segment[]>;
  updateSegmentEnglishText(segmentId: string, englishText: string): Promise<Segment>;

  // Upload / generation pipeline (backed by n8n webhooks in real mode)
  createUploadSession(fileName: string, mimeType: string, size: number): Promise<{ uploadUrl: string }>;
  uploadFile(uploadUrl: string, file: File, onProgress: (loaded: number, total: number) => void): UploadHandle;
  notifyVideoUploaded(req: VideoUploadedRequest | { videoId: string }): Promise<{ videoId: string }>;
  requestGenerate(videoId: string): Promise<void>;

  // Demo-only affordance: switch the fake logged-in user's role
  setDemoRole?(role: Role): void;
  getDemoRole?(): Role;
}

export const api: Api = isDemoMode ? demoApi : supabaseApi;
