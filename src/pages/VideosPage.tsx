import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Video as VideoIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { Video, VideoStatus } from '../types';
import { StatusChip } from '../components/StatusChip';
import { UploadDialog } from '../components/UploadDialog';
import { formatDate, formatMMSS } from '../lib/format';

type FilterKey = 'all' | 'needs_review' | 'in_progress' | 'done' | 'failed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

function matchesFilter(status: VideoStatus, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'needs_review':
      return status === 'script_ready';
    case 'in_progress':
      return status === 'uploaded' || status === 'scripting' || status === 'generating';
    case 'done':
      return status === 'done';
    case 'failed':
      return status === 'failed';
  }
}

function UploaderName({ userId }: { userId: string | null }) {
  const { data } = useQuery({
    queryKey: ['uploader-name', userId],
    queryFn: () => api.getUploaderName(userId),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  return <>{data ?? '—'}</>;
}

function Credits({ video }: { video: Video }) {
  if (video.credits_used != null) return <>{video.credits_used} used</>;
  if (video.credits_estimate != null) return <>&asymp; {video.credits_estimate} est.</>;
  return <>—</>;
}

export function VideosPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: videos, isLoading, isError } = useQuery({
    queryKey: ['videos'],
    queryFn: () => api.listVideos(),
    refetchInterval: (query) => {
      const data = query.state.data as Video[] | undefined;
      const active = data?.some((v) => v.status === 'uploaded' || v.status === 'scripting' || v.status === 'generating');
      return active ? 5000 : 30000;
    },
  });

  const filtered = useMemo(() => {
    if (!videos) return [];
    const q = search.trim().toLowerCase();
    return videos.filter((v) => matchesFilter(v.status, filter) && (!q || v.title.toLowerCase().includes(q)));
  }, [videos, filter, search]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Videos</h1>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          New video
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                filter === f.key
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            aria-label="Search videos by title"
            className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="mt-4">
        {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading videos…</p>}
        {isError && <p className="text-sm text-red-600 dark:text-red-400">Could not load videos.</p>}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
            <VideoIcon size={28} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {videos && videos.length > 0
                ? 'No videos match your filters.'
                : 'Upload a Bangla walkthrough and we’ll turn it into an English voice-over you can review and approve.'}
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="hidden bg-slate-50 text-xs text-slate-500 sm:table-header-group dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Title</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Uploaded by</th>
                  <th className="px-4 py-2 font-medium">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((video) => (
                  <tr
                    key={video.id}
                    onClick={() => navigate(`/videos/${video.id}`)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-50">{video.title}</td>
                    <td className="px-4 py-3">
                      <StatusChip status={video.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatMMSS(video.duration_sec)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(video.created_at)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <UploaderName userId={video.uploaded_by} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <Credits video={video} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {uploadOpen && (
        <UploadDialog
          onClose={() => setUploadOpen(false)}
          onCreated={(videoId) => navigate(`/videos/${videoId}`)}
        />
      )}
    </div>
  );
}
