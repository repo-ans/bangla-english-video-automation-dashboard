import { Sparkles } from 'lucide-react';

interface StickyGenerateBarProps {
  regenCount: number;
  estimatedCredits: number;
  disabled: boolean;
  busy: boolean;
  onApprove: () => void;
}

export function StickyGenerateBar({ regenCount, estimatedCredits, disabled, busy, onApprove }: StickyGenerateBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-xl sm:border dark:border-slate-700 dark:bg-slate-800/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {regenCount} segment{regenCount === 1 ? '' : 's'} will be regenerated &middot; &asymp; {estimatedCredits}{' '}
          ElevenLabs credits
        </p>
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={15} />
          {busy ? 'Starting…' : 'Approve and Generate'}
        </button>
      </div>
    </div>
  );
}
