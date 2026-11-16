import type { Api, AuthUser, UploadHandle, VideoUploadedRequest } from './api';
import type { Profile, Segment, Settings, Video } from '../types';
import { requireSupabase } from './supabase';
import * as n8n from './n8n';
import { uploadFileToDrive } from './upload';

function toAuthUser(user: { id: string; email?: string | null } | null | undefined): AuthUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? '' };
}

export const supabaseApi: Api = {
  async getSession() {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw new Error(error.message);
    return toAuthUser(data.session?.user ?? null);
  },

  onAuthStateChange(callback) {
    const { data } = requireSupabase().auth.onAuthStateChange((_event, session) => {
      callback(toAuthUser(session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  },

  async signInWithPassword(email, password) {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async signInWithMagicLink(email) {
    const { error } = await requireSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(password) {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getProfile(userId) {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Profile | null) ?? null;
  },

  async getUploaderName(userId) {
    if (!userId) return null;
    try {
      const { data } = await requireSupabase()
        .from('profiles')
        .select('name')
        .eq('user_id', userId)
        .maybeSingle();
      return (data as { name: string | null } | null)?.name ?? null;
    } catch {
      return null;
    }
  },

  async getSettings() {
    const { data, error } = await requireSupabase().from('settings').select('*').eq('id', 1).single();
    if (error) throw new Error(error.message);
    return coerceSettings(data as Record<string, unknown>);
  },

  async updateSettings(patch) {
    const { data, error } = await requireSupabase()
      .from('settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return coerceSettings(data as Record<string, unknown>);
  },

  async listVideos() {
    const { data, error } = await requireSupabase()
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Video[]).map(coerceVideo);
  },

  async getVideo(id) {
    const { data, error } = await requireSupabase().from('videos').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? coerceVideo(data as Video) : null;
  },

  async getSegments(videoId) {
    const { data, error } = await requireSupabase()
      .from('segments')
      .select('*')
      .eq('video_id', videoId)
      .order('idx', { ascending: true });
    if (error) throw new Error(error.message);
    return (data as Segment[]).map(coerceSegment);
  },

  async updateSegmentEnglishText(segmentId, englishText) {
    const { data, error } = await requireSupabase()
      .from('segments')
      .update({ english_text: englishText })
      .eq('id', segmentId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return coerceSegment(data as Segment);
  },

  createUploadSession(fileName, mimeType, size) {
    return n8n.createUploadSession({ fileName, mimeType, size });
  },

  uploadFile(uploadUrl, file, onProgress): UploadHandle {
    return uploadFileToDrive(uploadUrl, file, onProgress);
  },

  notifyVideoUploaded(req: VideoUploadedRequest | { videoId: string }) {
    return n8n.notifyVideoUploaded(req);
  },

  async requestGenerate(videoId) {
    await n8n.requestGenerate(videoId);
  },
};

function coerceVideo(row: Video): Video {
  return {
    ...row,
    duration_sec: row.duration_sec == null ? null : Number(row.duration_sec),
    credits_estimate: row.credits_estimate == null ? null : Number(row.credits_estimate),
    credits_used: row.credits_used == null ? null : Number(row.credits_used),
  };
}

function coerceSegment(row: Segment): Segment {
  return {
    ...row,
    idx: Number(row.idx),
    start_sec: Number(row.start_sec),
    end_sec: Number(row.end_sec),
    word_limit: Number(row.word_limit),
    audio_duration_sec: row.audio_duration_sec == null ? null : Number(row.audio_duration_sec),
  };
}

function coerceSettings(row: Record<string, unknown>): Settings {
  return {
    id: 1,
    voice_id: (row.voice_id as string | null) ?? null,
    tts_model: String(row.tts_model ?? 'eleven_multilingual_v2'),
    stability: Number(row.stability ?? 0.4),
    similarity: Number(row.similarity ?? 0.8),
    speed_cap: Number(row.speed_cap ?? 1.15),
    words_per_sec: Number(row.words_per_sec ?? 2.2),
    style_sample: String(row.style_sample ?? ''),
    glossary: String(row.glossary ?? ''),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}
