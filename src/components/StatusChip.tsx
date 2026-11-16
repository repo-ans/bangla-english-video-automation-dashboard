import clsx from 'clsx';
import type { VideoStatus } from '../types';

const STATUS_LABEL: Record<VideoStatus, string> = {
  uploaded: 'Uploaded',
  scripting: 'Writing script…',
  script_ready: 'Needs review',
  generating: 'Generating voice…',
  done: 'Done',
  failed: 'Failed',
};

const STATUS_CLASS: Record<VideoStatus, string> = {
  uploaded: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  scripting: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  script_ready: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  generating: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function StatusChip({ status, className }: { status: VideoStatus; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        STATUS_CLASS[status],
        className
      )}
    >
      {(status === 'scripting' || status === 'generating') && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
