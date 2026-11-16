import { supabase } from './supabase';

export class N8nError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'N8nError';
    this.status = status;
  }
}

const BASE_URL = (import.meta.env.VITE_N8N_BASE_URL ?? '').replace(/\/+$/, '');

async function getAccessToken(): Promise<string> {
  if (!supabase) throw new N8nError('Not signed in.', 401);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new N8nError('Your session has expired. Please sign in again.', 401);
  return token;
}

async function post<TResponse>(path: string, body: unknown): Promise<TResponse> {
  let token: string;
  try {
    token = await getAccessToken();
  } catch {
    throw new N8nError('Your session has expired. Please sign in again.', 401);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new N8nError('Could not reach the automation server. Check your connection and try again.');
  }

  if (res.status === 401) {
    if (supabase) await supabase.auth.signOut();
    throw new N8nError('Your session has expired. Please sign in again.', 401);
  }

  if (res.status === 409) {
    const message = await safeErrorMessage(res, 'This action is already in progress.');
    throw new N8nError(message, 409);
  }

  if (!res.ok) {
    const message = await safeErrorMessage(res, `Request failed (${res.status}).`);
    throw new N8nError(message, res.status);
  }

  if (res.status === 202) {
    return { ok: true } as TResponse;
  }

  try {
    return (await res.json()) as TResponse;
  } catch {
    throw new N8nError('The server returned an unexpected response.', res.status);
  }
}

async function safeErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export interface UploadSessionRequest {
  fileName: string;
  mimeType: string;
  size: number;
}
export interface UploadSessionResponse {
  uploadUrl: string;
}

export function createUploadSession(req: UploadSessionRequest): Promise<UploadSessionResponse> {
  return post<UploadSessionResponse>('/vtx/upload-session', req);
}

export type VideoUploadedRequest =
  | { driveFileId: string; title: string; durationSec: number | null }
  | { videoId: string };
export interface VideoUploadedResponse {
  videoId: string;
}

export function notifyVideoUploaded(req: VideoUploadedRequest): Promise<VideoUploadedResponse> {
  return post<VideoUploadedResponse>('/vtx/video-uploaded', req);
}

export interface GenerateResponse {
  ok: true;
}

export function requestGenerate(videoId: string): Promise<GenerateResponse> {
  return post<GenerateResponse>('/vtx/generate', { videoId });
}
