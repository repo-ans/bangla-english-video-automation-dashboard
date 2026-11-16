import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { api } from '../lib/api';
import { useProfile } from '../hooks/useProfile';
import { StatusChip } from '../components/StatusChip';
import { SegmentCard } from '../components/SegmentCard';
import { StickyGenerateBar } from '../components/StickyGenerateBar';
import { SyncReport } from '../components/SyncReport';
import { ConfirmModal } from '../components/ConfirmModal';
import { errorMessage } from '../lib/errors';
import { useToast } from '../hooks/useToast';
import { segmentHash } from '../lib/hash';
import { formatMMSS, drivePreviewLink } from '../lib/format';
import { parseSyncReport, type Video } from '../types';

const EDITABLE_STATUSES = new Set(['script_ready', 'done', 'failed']);

export function VideoDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: profile } = useProfile();

  const [previewTab, setPreviewTab] = useState<'original' | 'final'>('original');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const fieldRefs = useRef<Map<number, HTMLTextAreaElement | null>>(new Map());

  const videoQuery = useQuery({
    queryKey: ['video', id],
    queryFn: () => api.getVideo(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as Video | null | undefined;
      if (!data) return false;
      return data.status === 'uploaded' || data.status === 'scripting' || data.status === 'generating' ? 5000 : false;
    },
  });

  const video = videoQuery.data ?? null;

  const segmentsQuery = useQuery({
    queryKey: ['segments', id],
    queryFn: () => api.getSegments(id),
    enabled: !!id && !!video,
    refetchInterval: video && (video.status === 'scripting' || video.status === 'generating') ? 5000 : false,
  });
  const segments = segmentsQuery.data ?? [];

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => api.getSettings() });
  const settings = settingsQuery.data;

  const saveMutation = useMutation({
    mutationFn: ({ segmentId, text }: { segmentId: string; text: string }) =>
      api.updateSegmentEnglishText(segmentId, text),
    onSuccess: (updated) => {
      queryClient.setQueryData<typeof segments>(['segments', id], (old) =>
        old ? old.map((s) => (s.id === updated.id ? updated : s)) : old
      );
    },
    onError: (err) => showToast(errorMessage(err, 'Could not save that segment.'), 'error'),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.requestGenerate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video', id] });
      showToast('Generation started.', 'success');
    },
    onError: (err) => showToast(errorMessage(err, 'Could not start generation.'), 'error'),
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (segments.length === 0) {
        await api.notifyVideoUploaded({ videoId: id });
      } else {
        await api.requestGenerate(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video', id] });
      queryClient.invalidateQueries({ queryKey: ['segments', id] });
    },
    onError: (err) => showToast(errorMessage(err, 'Retry failed.'), 'error'),
  });

  const canEdit = profile?.role === 'ceo' && !!video && EDITABLE_STATUSES.has(video.status);

  const regenSegments = settings
    ? segments.filter((s) => {
        const hash = segmentHash(settings, s.english_text);
        return hash !== s.audio_text_hash || !s.audio_path || s.audio_duration_sec == null;
      })
    : [];

  const estimatedCredits = regenSegments.reduce((sum, s) => sum + s.english_text.trim().length, 0);

  const overLimitCount = segments.filter(
    (s) => s.word_limit > 0 && s.english_text.trim().split(/\s+/).filter(Boolean).length > s.word_limit
  ).length;
  const noteSegments = segments.filter((s) => s.check_note.trim().length > 0);

  const anyPending = pendingIds.size > 0;

  function handlePendingChange(segmentId: string, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(segmentId);
      else next.delete(segmentId);
      return next;
    });
  }

  function scrollToIndex(idx: number) {
    const el = cardRefs.current.get(idx);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function handleFirstNoteClick() {
    if (noteSegments.length === 0) return;
    const idx = segments.findIndex((s) => s.id === noteSegments[0].id);
    if (idx >= 0) scrollToIndex(idx);
  }

  function handleSyncRowClick(idx: number) {
    scrollToIndex(idx);
  }

  async function handleRetry() {
    await retryMutation.mutateAsync();
  }

  async function handleApproveConfirmed() {
    setConfirmOpen(false);
    await generateMutation.mutateAsync();
  }

  if (videoQuery.isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }
  if (videoQuery.isError || !video) {
    return <p className="text-sm text-red-600 dark:text-red-400">Could not load this video.</p>;
  }

  const syncRows = parseSyncReport(video.sync_report);
  const waiting = video.status === 'uploaded' || video.status === 'scripting';

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => navigate('/videos')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft size={14} /> Back to videos
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{video.title}</h1>
            <StatusChip status={video.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatMMSS(video.duration_sec)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={video.drive_link ?? `https://drive.google.com/file/d/${video.drive_file_id}/view`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Open original in Drive <ExternalLink size={13} />
          </a>
          {video.status === 'done' && video.final_drive_link && (
            <>
              <a
                href={video.final_drive_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Open final video <ExternalLink size={13} />
              </a>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(video.final_drive_link!);
                  showToast('Link copied.', 'success');
                }}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Copy size={13} /> Copy link
              </button>
            </>
          )}
        </div>
      </div>

      {video.summary && (
        <div className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {video.summary}
        </div>
      )}

      {video.status === 'failed' && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="flex-1">
              <p>{video.error ?? 'Something went wrong.'}</p>
            </div>
          </div>
          {(profile?.role === 'ceo' || segments.length === 0) && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retryMutation.isPending}
              className="mt-2 flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {retryMutation.isPending ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      )}

      {waiting && (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Loader2 size={16} className="animate-spin" />
          {video.status === 'uploaded' ? 'Waiting for script generation to start…' : 'Writing the English script…'}
        </div>
      )}

      {/* Video preview */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Preview
          {previewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {previewOpen && (
          <div className="px-4 pb-4">
            {video.final_drive_link && (
              <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPreviewTab('original')}
                  className={`flex-1 rounded-md py-1.5 font-medium ${
                    previewTab === 'original' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Original
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('final')}
                  className={`flex-1 rounded-md py-1.5 font-medium ${
                    previewTab === 'final' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Final
                </button>
              </div>
            )}
            <div className="aspect-video w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-900">
              <iframe
                key={previewTab}
                src={drivePreviewLink(
                  previewTab === 'final' && video.final_drive_file_id ? video.final_drive_file_id : video.drive_file_id
                )}
                className="h-full w-full"
                allow="autoplay"
                title="Video preview"
              />
            </div>
          </div>
        )}
      </div>

      {/* Segments */}
      {segments.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Script</h2>
            {noteSegments.length > 0 && (
              <button
                type="button"
                onClick={handleFirstNoteClick}
                className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
              >
                <AlertTriangle size={13} />
                {noteSegments.length} segment{noteSegments.length === 1 ? '' : 's'} need attention
              </button>
            )}
          </div>

          <div className="space-y-3">
            {segments.map((segment, index) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                settings={
                  settings ?? {
                    id: 1,
                    voice_id: null,
                    tts_model: 'eleven_multilingual_v2',
                    stability: 0.4,
                    similarity: 0.8,
                    speed_cap: 1.15,
                    words_per_sec: 2.2,
                    style_sample: '',
                    glossary: '',
                    updated_at: '',
                  }
                }
                canEdit={!!canEdit}
                index={index}
                total={segments.length}
                onSave={(segmentId, text) => saveMutation.mutateAsync({ segmentId, text }).then(() => undefined)}
                onPendingChange={handlePendingChange}
                onCtrlEnter={(idx) => fieldRefs.current.get(idx + 1)?.focus()}
                registerFieldRef={(idx, el) => fieldRefs.current.set(idx, el)}
                cardRef={(el) => cardRefs.current.set(index, el)}
              />
            ))}
          </div>

          {canEdit && settings && (
            <StickyGenerateBar
              regenCount={regenSegments.length}
              estimatedCredits={estimatedCredits}
              busy={generateMutation.isPending}
              disabled={anyPending || generateMutation.isPending || video.status === 'generating'}
              onApprove={() => setConfirmOpen(true)}
            />
          )}
        </div>
      )}

      {video.status === 'done' && syncRows.length > 0 && <SyncReport rows={syncRows} onRowClick={handleSyncRowClick} />}

      <ConfirmModal
        open={confirmOpen}
        title="Approve and generate voice-over?"
        confirmLabel="Approve and Generate"
        busy={generateMutation.isPending}
        onConfirm={handleApproveConfirmed}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          {regenSegments.length} segment{regenSegments.length === 1 ? '' : 's'} will be regenerated, &asymp;{' '}
          {estimatedCredits} ElevenLabs credits.
        </p>
        {overLimitCount > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={14} /> {overLimitCount} segment{overLimitCount === 1 ? '' : 's'} over the word limit.
          </p>
        )}
        {noteSegments.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle size={14} /> {noteSegments.length} segment{noteSegments.length === 1 ? '' : 's'}{' '}
            {noteSegments.length === 1 ? 'has' : 'have'} a review note.
          </p>
        )}
        {overLimitCount === 0 && noteSegments.length === 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Check size={14} /> No issues flagged.
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}
