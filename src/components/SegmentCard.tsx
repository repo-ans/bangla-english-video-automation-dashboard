import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Volume2 } from 'lucide-react';
import type { Segment, Settings } from '../types';
import { segmentHash } from '../lib/hash';
import { formatMMSSTenths } from '../lib/format';
import { useToast } from '../hooks/useToast';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SegmentCardProps {
  segment: Segment;
  settings: Settings;
  canEdit: boolean;
  index: number;
  total: number;
  onSave: (segmentId: string, englishText: string) => Promise<void>;
  onCtrlEnter: (index: number) => void;
  registerFieldRef: (index: number, el: HTMLTextAreaElement | null) => void;
  cardRef?: (el: HTMLDivElement | null) => void;
  onPendingChange?: (segmentId: string, pending: boolean) => void;
}

function countWords(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function AutoGrowTextarea({
  value,
  onChange,
  onKeyDown,
  readOnly,
  elRef,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  readOnly: boolean;
  elRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // border-box sizing means scrollHeight (content+padding) excludes the border,
    // so add it back or the box ends up a hair short and shows a scrollbar.
    const borderWidth = el.offsetHeight - el.clientHeight;
    el.style.height = `${el.scrollHeight + borderWidth}px`;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        elRef(el);
      }}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      readOnly={readOnly}
      rows={3}
      className={clsx(
        'block w-full resize-none rounded-md border px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1',
        readOnly
          ? 'cursor-default border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
          : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
      )}
    />
  );
}

export function SegmentCard({
  segment,
  settings,
  canEdit,
  index,
  total,
  onSave,
  onCtrlEnter,
  registerFieldRef,
  cardRef,
  onPendingChange,
}: SegmentCardProps) {
  const { showToast } = useToast();
  const [value, setValue] = useState(segment.english_text);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const savedRef = useRef(segment.english_text);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [previewState, setPreviewState] = useState<'idle' | 'speaking' | 'done'>('idle');
  const [previewElapsed, setPreviewElapsed] = useState<number | null>(null);

  useEffect(() => {
    if (segment.english_text !== savedRef.current) {
      setValue(segment.english_text);
      savedRef.current = segment.english_text;
      setStatus('idle');
    }
  }, [segment.english_text]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function scheduleSave(nextValue: string) {
    clearTimeout(timerRef.current);
    onPendingChange?.(segment.id, true);
    timerRef.current = setTimeout(() => {
      const trimmed = nextValue.replace(/[ \t]+$/, '');
      if (trimmed === savedRef.current) {
        setStatus('idle');
        onPendingChange?.(segment.id, false);
        return;
      }
      setStatus('saving');
      onSave(segment.id, trimmed)
        .then(() => {
          savedRef.current = trimmed;
          setStatus('saved');
        })
        .catch(() => setStatus('error'))
        .finally(() => onPendingChange?.(segment.id, false));
    }, 800);
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    scheduleSave(v);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onCtrlEnter(index);
    }
  }

  function handleTimestampClick() {
    showToast(`Jump to ${formatMMSSTenths(segment.start_sec)} in the player`, 'info');
  }

  function handlePreview() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Browser voice preview is not supported here.', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    if (enVoice) utterance.voice = enVoice;

    const start = performance.now();
    setPreviewState('speaking');
    setPreviewElapsed(null);
    utterance.onend = () => {
      setPreviewElapsed((performance.now() - start) / 1000);
      setPreviewState('done');
    };
    utterance.onerror = () => setPreviewState('idle');
    window.speechSynthesis.speak(utterance);
  }

  const words = countWords(value);
  const wordRatio = segment.word_limit > 0 ? words / segment.word_limit : 0;
  const wordColor =
    wordRatio <= 1 ? 'text-green-600 dark:text-green-400' : wordRatio <= 1.1 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  const hash = segmentHash(settings, value);
  const audioUpToDate = hash === segment.audio_text_hash && !!segment.audio_path && segment.audio_duration_sec != null;

  const availableSec = segment.end_sec - segment.start_sec;
  const hasNote = segment.check_note.trim().length > 0;

  return (
    <div
      ref={cardRef}
      className={clsx(
        'rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800',
        hasNote ? 'border-l-4 border-amber-400 border-y-slate-200 border-r-slate-200 dark:border-y-slate-700 dark:border-r-slate-700' : 'border-slate-200 dark:border-slate-700'
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Segment {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={handleTimestampClick}
            className="font-mono text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            {formatMMSSTenths(segment.start_sec)} – {formatMMSSTenths(segment.end_sec)}
          </button>
          <span>({availableSec.toFixed(1)}s)</span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-4 md:flex-row">
        <div className="md:w-1/2">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Bangla (original)</p>
          <p className="font-bengali rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
            {segment.bangla_text}
          </p>
        </div>

        <div className="md:w-1/2">
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">English</p>
          <AutoGrowTextarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            readOnly={!canEdit}
            elRef={(el) => registerFieldRef(index, el)}
          />

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-3">
              <span className={wordColor}>
                {words} / {segment.word_limit} words
              </span>
              <span className="text-slate-400 dark:text-slate-500">{value.length} chars</span>
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 font-medium',
                  audioUpToDate
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                )}
              >
                {audioUpToDate ? 'Audio is up to date' : 'Will be regenerated'}
              </span>
            </div>
            {canEdit && (
              <span className="text-slate-400 dark:text-slate-500">
                {status === 'saving' && 'Saving…'}
                {status === 'saved' && 'Saved'}
                {status === 'error' && (
                  <span className="text-red-600 dark:text-red-400">Error — retrying on next change</span>
                )}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewState === 'speaking'}
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Volume2 size={13} />
              {previewState === 'speaking' ? 'Speaking…' : 'Preview (browser voice)'}
            </button>
            {previewState === 'done' && previewElapsed != null && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Spoke in {previewElapsed.toFixed(1)}s vs {availableSec.toFixed(1)}s available
              </span>
            )}
          </div>

          {hasNote && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{segment.check_note}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
