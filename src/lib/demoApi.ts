import type { Api, AuthUser, UploadHandle, VideoUploadedRequest } from './api';
import type { Profile, Role, Segment, Settings, SyncRow, Video } from '../types';
import { segmentHash } from './hash';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

const DEMO_USER_ID = 'demo-user';
const DEMO_USER: AuthUser = { id: DEMO_USER_ID, email: 'ceo@demo.vtx' };

const UPLOADER_NAMES: Record<string, string> = {
  'dev-1': 'Rafiq Islam',
  'dev-2': 'Nadia Chowdhury',
  'ceo-1': 'Alex Rahman',
};

let demoRole: Role = 'ceo';
let isSignedIn = true;
const authListeners = new Set<(user: AuthUser | null) => void>();

function currentProfile(): Profile {
  return demoRole === 'ceo'
    ? { user_id: DEMO_USER_ID, name: 'Alex Rahman', role: 'ceo', created_at: hoursAgo(1000) }
    : { user_id: DEMO_USER_ID, name: 'Rafiq Islam', role: 'dev', created_at: hoursAgo(1000) };
}

let settings: Settings = {
  id: 1,
  voice_id: 'ceo-cloned-voice-01',
  tts_model: 'eleven_multilingual_v2',
  stability: 0.4,
  similarity: 0.8,
  speed_cap: 1.15,
  words_per_sec: 2.2,
  style_sample:
    'Hey everyone, welcome back. Today I want to walk you through something that took us way too long to figure out the first time around — so hopefully this saves you some time.',
  glossary: 'ড্যাশবোর্ড = dashboard\nইনভয়েস = invoice\nসিঙ্ক = sync',
  updated_at: hoursAgo(72),
};

const SAMPLE_PAIRS: [string, string][] = [
  [
    'আপনাকে স্বাগতম। এই ভিডিওতে আমরা দেখাবো কীভাবে ড্যাশবোর্ড ব্যবহার করতে হয়।',
    'Welcome. In this video, we will show you how to use the dashboard.',
  ],
  [
    'প্রথমে, বাম পাশের মেনু থেকে "ভিডিও" ট্যাবে ক্লিক করুন।',
    'First, click the "Videos" tab in the left-hand menu.',
  ],
  [
    'এখানে আপনি সব আপলোড করা ভিডিওর একটি তালিকা দেখতে পাবেন, তাদের স্ট্যাটাস সহ।',
    'Here you will see a list of all uploaded videos, along with their status.',
  ],
  [
    'নতুন একটি ভিডিও যুক্ত করতে, উপরের ডান কোণায় "নতুন ভিডিও" বাটনে ক্লিক করুন।',
    'To add a new video, click the "New video" button in the top-right corner.',
  ],
  [
    'ফাইলটি সরাসরি আপনার ব্রাউজার থেকে গুগল ড্রাইভে আপলোড হবে, কোনো সার্ভারে নয়।',
    'The file uploads straight from your browser to Google Drive, not through a server.',
  ],
  [
    'আপলোড সম্পন্ন হলে, স্বয়ংক্রিয় সিস্টেম স্ক্রিপ্ট তৈরি করা শুরু করবে।',
    'Once the upload finishes, the automation will start generating the script.',
  ],
  [
    'স্ক্রিপ্ট তৈরি হয়ে গেলে, সিইও বাংলা এবং ইংরেজি পাশাপাশি দেখে পর্যালোচনা করতে পারবেন।',
    'Once the script is ready, the CEO can review the Bangla and English side by side.',
  ],
  [
    'প্রতিটি অংশের জন্য একটি শব্দ সীমা আছে, যাতে অনুবাদ নির্ধারিত সময়ের মধ্যে ফিট করে।',
    'Each segment has a word limit so the translation fits within its allotted time.',
  ],
  [
    'সম্পাদনা শেষে, "অনুমোদন করুন এবং তৈরি করুন" বাটনে ক্লিক করুন।',
    'When editing is done, click the "Approve and Generate" button.',
  ],
  [
    'এরপর সিস্টেম কণ্ঠস্বর তৈরি করবে এবং ভিডিওর সাথে মিলিয়ে দেবে।',
    'The system will then generate the voice-over and merge it with the video.',
  ],
  [
    'সম্পূর্ণ হলে, চূড়ান্ত ভিডিওটি গুগল ড্রাইভের আউটপুট ফোল্ডারে পাওয়া যাবে।',
    'Once complete, the final video will be available in the Google Drive output folder.',
  ],
  [
    'ধন্যবাদ দেখার জন্য, পরের ভিডিওতে আমরা আরও বিস্তারিত দেখাবো।',
    'Thanks for watching, and we will cover more detail in the next video.',
  ],
];

function buildSegments(videoId: string, count: number): Segment[] {
  const segs: Segment[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const [bn, en] = SAMPLE_PAIRS[i % SAMPLE_PAIRS.length];
    const dur = 6 + (i % 4) * 1.5;
    const start = t;
    const end = t + dur;
    t = end + 0.4;
    segs.push({
      id: `${videoId}-seg-${i}`,
      video_id: videoId,
      idx: i,
      start_sec: Number(start.toFixed(1)),
      end_sec: Number(end.toFixed(1)),
      word_limit: Math.max(4, Math.round(dur * settings.words_per_sec)),
      bangla_text: bn,
      english_text: en,
      check_note: '',
      audio_path: null,
      audio_text_hash: null,
      audio_duration_sec: null,
      updated_at: nowIso(),
    });
  }
  return segs;
}

function markSegmentAudioUpToDate(seg: Segment, audioDurationSec: number) {
  seg.audio_path = `audio/${seg.video_id}/${seg.idx}.mp3`;
  seg.audio_text_hash = segmentHash(settings, seg.english_text);
  seg.audio_duration_sec = audioDurationSec;
}

// --- Seed data -------------------------------------------------------------

const v1Id = 'demo-v1';
const v2Id = 'demo-v2';
const v3Id = 'demo-v3';
const v4Id = 'demo-v4';

const v2Segments = buildSegments(v2Id, 7);
v2Segments[3].check_note = 'Bangla mentions a specific discount code — confirm the English keeps the same code.';
v2Segments[5].english_text =
  'And just to be extra clear about this particular point, because it trips a lot of people up the first time, make sure the sync job has actually finished before you close this tab.';

const v3Segments = buildSegments(v3Id, 8);
v3Segments.forEach((seg, i) => {
  const available = seg.end_sec - seg.start_sec;
  const audioDur = i === 2 ? available + 1.8 : i === 5 ? available + 0.6 : available * 0.92;
  markSegmentAudioUpToDate(seg, Number(audioDur.toFixed(2)));
});
// Simulate an edit made after generation, so one segment needs regeneration.
v3Segments[6].english_text = 'After exporting, double-check the totals against last month before you send it out.';
v3Segments[6].updated_at = nowIso();

const v3SyncReport: SyncRow[] = v3Segments.map((seg, i) => {
  const available = Number((seg.end_sec - seg.start_sec).toFixed(2));
  const audio = seg.audio_duration_sec ?? available;
  const speed = Number((audio / available).toFixed(2));
  const overflow = Math.max(0, Number((audio - available).toFixed(2)));
  const status: SyncRow['status'] = i === 2 ? 'red' : i === 5 ? 'yellow' : 'green';
  return { idx: i, start: seg.start_sec, available, audio, speed, overflow_sec: overflow, status };
});

const v4Segments = buildSegments(v4Id, 6);

const videos: Video[] = [
  {
    id: v1Id,
    title: 'Customer Onboarding Walkthrough',
    status: 'scripting',
    drive_file_id: 'demo-drive-aaa',
    drive_link: 'https://drive.google.com/file/d/demo-drive-aaa/view',
    duration_sec: 184,
    summary: null,
    final_drive_file_id: null,
    final_drive_link: null,
    credits_estimate: null,
    credits_used: null,
    sync_report: null,
    error: null,
    uploaded_by: 'dev-1',
    approved_by: null,
    approved_at: null,
    created_at: hoursAgo(0.3),
    updated_at: hoursAgo(0.3),
  },
  {
    id: v2Id,
    title: 'Inventory Sync Walkthrough',
    status: 'script_ready',
    drive_file_id: 'demo-drive-bbb',
    drive_link: 'https://drive.google.com/file/d/demo-drive-bbb/view',
    duration_sec: 262,
    summary:
      'Developer demonstrates the nightly inventory sync job and how to re-run it after a failure.',
    final_drive_file_id: null,
    final_drive_link: null,
    credits_estimate: v2Segments.reduce((sum, s) => sum + s.english_text.trim().length, 0),
    credits_used: null,
    sync_report: null,
    error: null,
    uploaded_by: 'dev-2',
    approved_by: null,
    approved_at: null,
    created_at: hoursAgo(5),
    updated_at: hoursAgo(1),
  },
  {
    id: v3Id,
    title: 'Monthly Report Export',
    status: 'done',
    drive_file_id: 'demo-drive-ccc',
    drive_link: 'https://drive.google.com/file/d/demo-drive-ccc/view',
    duration_sec: 301,
    summary:
      'Walkthrough of exporting the monthly finance report to PDF and sharing it with stakeholders.',
    final_drive_file_id: 'demo-final-ccc',
    final_drive_link: 'https://drive.google.com/file/d/demo-final-ccc/view',
    credits_estimate: 412,
    credits_used: 398,
    sync_report: v3SyncReport,
    error: null,
    uploaded_by: 'ceo-1',
    approved_by: DEMO_USER_ID,
    approved_at: hoursAgo(26),
    created_at: hoursAgo(30),
    updated_at: hoursAgo(25),
  },
  {
    id: v4Id,
    title: 'Bulk Import Tool',
    status: 'failed',
    drive_file_id: 'demo-drive-ddd',
    drive_link: 'https://drive.google.com/file/d/demo-drive-ddd/view',
    duration_sec: 145,
    summary: 'Shows how to bulk-import products from a CSV file.',
    final_drive_file_id: null,
    final_drive_link: null,
    credits_estimate: v4Segments.reduce((sum, s) => sum + s.english_text.trim().length, 0),
    credits_used: null,
    sync_report: null,
    error: 'ElevenLabs returned a rate-limit error after 3 retries. Try again in a few minutes.',
    uploaded_by: 'dev-1',
    approved_by: DEMO_USER_ID,
    approved_at: hoursAgo(2),
    created_at: hoursAgo(3),
    updated_at: hoursAgo(1.9),
  },
];

const segmentsByVideo: Record<string, Segment[]> = {
  [v1Id]: [],
  [v2Id]: v2Segments,
  [v3Id]: v3Segments,
  [v4Id]: v4Segments,
};

function findVideo(id: string): Video | undefined {
  return videos.find((v) => v.id === id);
}

function cloneVideo(v: Video): Video {
  return { ...v };
}

function cloneSegment(s: Segment): Segment {
  return { ...s };
}

// --- Simulated background transitions --------------------------------------

function scheduleScriptReady(videoId: string) {
  setTimeout(() => {
    const video = findVideo(videoId);
    if (!video || video.status !== 'scripting') return;
    if (!segmentsByVideo[videoId] || segmentsByVideo[videoId].length === 0) {
      segmentsByVideo[videoId] = buildSegments(videoId, 6 + Math.floor(Math.random() * 3));
    }
    video.status = 'script_ready';
    video.summary = video.summary ?? 'Automatically generated summary of this walkthrough.';
    video.credits_estimate = segmentsByVideo[videoId].reduce(
      (sum, s) => sum + s.english_text.trim().length,
      0
    );
    video.updated_at = nowIso();
  }, 4500);
}

function scheduleGenerateCompletion(videoId: string) {
  setTimeout(() => {
    const video = findVideo(videoId);
    if (!video || video.status !== 'generating') return;
    const segs = segmentsByVideo[videoId] ?? [];
    let used = 0;
    const report: SyncRow[] = segs.map((seg) => {
      const hash = segmentHash(settings, seg.english_text);
      const needsRegen = hash !== seg.audio_text_hash || !seg.audio_path || seg.audio_duration_sec == null;
      if (needsRegen) {
        used += seg.english_text.trim().length;
        const available = seg.end_sec - seg.start_sec;
        const audioDur = Number((available * (0.85 + Math.random() * 0.2)).toFixed(2));
        markSegmentAudioUpToDate(seg, audioDur);
      }
      const available = Number((seg.end_sec - seg.start_sec).toFixed(2));
      const audio = seg.audio_duration_sec ?? available;
      const speed = Number((audio / available).toFixed(2));
      const overflow = Math.max(0, Number((audio - available).toFixed(2)));
      const status: SyncRow['status'] = overflow > 1 ? 'red' : overflow > 0.2 ? 'yellow' : 'green';
      return { idx: seg.idx, start: seg.start_sec, available, audio, speed, overflow_sec: overflow, status };
    });

    video.status = 'done';
    video.error = null;
    video.final_drive_file_id = `demo-final-${uid()}`;
    video.final_drive_link = `https://drive.google.com/file/d/${video.final_drive_file_id}/view`;
    video.sync_report = report;
    video.credits_used = (video.credits_used ?? 0) + used;
    video.approved_by = DEMO_USER_ID;
    video.approved_at = nowIso();
    video.updated_at = nowIso();
  }, 5000);
}

// --- API implementation -----------------------------------------------------

export const demoApi: Api = {
  async getSession() {
    await delay(150);
    return isSignedIn ? DEMO_USER : null;
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    return () => authListeners.delete(callback);
  },

  async signInWithPassword() {
    await delay(400);
    isSignedIn = true;
    authListeners.forEach((cb) => cb(DEMO_USER));
  },

  async signInWithMagicLink() {
    await delay(400);
    isSignedIn = true;
    authListeners.forEach((cb) => cb(DEMO_USER));
  },

  async updatePassword() {
    await delay(300);
  },

  async signOut() {
    await delay(200);
    isSignedIn = false;
    authListeners.forEach((cb) => cb(null));
  },

  async getProfile() {
    await delay(100);
    return currentProfile();
  },

  async getUploaderName(userId) {
    await delay(50);
    if (!userId) return null;
    return UPLOADER_NAMES[userId] ?? null;
  },

  async getSettings() {
    await delay(150);
    return { ...settings };
  },

  async updateSettings(patch) {
    await delay(300);
    settings = { ...settings, ...patch, updated_at: nowIso() };
    return { ...settings };
  },

  async listVideos() {
    await delay(250);
    return [...videos].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(cloneVideo);
  },

  async getVideo(id) {
    await delay(150);
    const v = findVideo(id);
    return v ? cloneVideo(v) : null;
  },

  async getSegments(videoId) {
    await delay(150);
    return (segmentsByVideo[videoId] ?? []).slice().sort((a, b) => a.idx - b.idx).map(cloneSegment);
  },

  async updateSegmentEnglishText(segmentId, englishText) {
    await delay(200);
    for (const videoId of Object.keys(segmentsByVideo)) {
      const seg = segmentsByVideo[videoId].find((s) => s.id === segmentId);
      if (seg) {
        seg.english_text = englishText;
        seg.updated_at = nowIso();
        return cloneSegment(seg);
      }
    }
    throw new Error('Segment not found.');
  },

  async createUploadSession() {
    await delay(300);
    return { uploadUrl: 'demo://upload' };
  },

  uploadFile(_uploadUrl, file, onProgress): UploadHandle {
    const total = file.size || 20 * 1024 * 1024;
    let loaded = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let rejectFn: (err: Error) => void = () => {};
    let settled = false;

    const promise = new Promise<{ id: string }>((resolve, reject) => {
      rejectFn = reject;
      timer = setInterval(() => {
        loaded = Math.min(total, loaded + total * (0.08 + Math.random() * 0.12));
        onProgress(Math.round(loaded), total);
        if (loaded >= total) {
          if (timer) clearInterval(timer);
          setTimeout(() => {
            if (!settled) {
              settled = true;
              resolve({ id: `demo-drive-${uid()}` });
            }
          }, 300);
        }
      }, 150);
    });

    return {
      promise,
      abort: () => {
        if (timer) clearInterval(timer);
        if (!settled) {
          settled = true;
          rejectFn(new Error('aborted'));
        }
      },
    };
  },

  async notifyVideoUploaded(req: VideoUploadedRequest | { videoId: string }) {
    await delay(300);
    if ('videoId' in req) {
      const video = findVideo(req.videoId);
      if (!video) throw new Error('Video not found.');
      video.status = 'scripting';
      video.error = null;
      video.updated_at = nowIso();
      scheduleScriptReady(video.id);
      return { videoId: video.id };
    }

    const id = `demo-v-${uid()}`;
    const newVideo: Video = {
      id,
      title: req.title,
      status: 'scripting',
      drive_file_id: req.driveFileId,
      drive_link: `https://drive.google.com/file/d/${req.driveFileId}/view`,
      duration_sec: req.durationSec,
      summary: null,
      final_drive_file_id: null,
      final_drive_link: null,
      credits_estimate: null,
      credits_used: null,
      sync_report: null,
      error: null,
      uploaded_by: DEMO_USER_ID,
      approved_by: null,
      approved_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    videos.unshift(newVideo);
    segmentsByVideo[id] = [];
    scheduleScriptReady(id);
    return { videoId: id };
  },

  async requestGenerate(videoId) {
    await delay(300);
    const video = findVideo(videoId);
    if (!video) throw new Error('Video not found.');
    if (!['script_ready', 'done', 'failed'].includes(video.status)) {
      throw new Error('This video is not ready to generate.');
    }
    video.status = 'generating';
    video.error = null;
    video.updated_at = nowIso();
    scheduleGenerateCompletion(videoId);
  },

  setDemoRole(role: Role) {
    demoRole = role;
  },

  getDemoRole() {
    return demoRole;
  },
};
