import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useProfile } from '../hooks/useProfile';
import { errorMessage } from '../lib/errors';
import { useToast } from '../hooks/useToast';
import type { Settings } from '../types';

const MODEL_OPTIONS = ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'];

export function SettingsPage() {
  const { data: profile } = useProfile();
  const readOnly = profile?.role !== 'ceo';

  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.getSettings() });

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  return <SettingsForm initialData={data} readOnly={readOnly} />;
}

function SettingsForm({ initialData, readOnly }: { initialData: Settings; readOnly: boolean }) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<Settings>(initialData);
  const [customModel, setCustomModel] = useState(() => !MODEL_OPTIONS.includes(initialData.tts_model));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<Settings>) => api.updateSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
      setForm(updated);
      setDirty(false);
      showToast('Settings saved.', 'success');
    },
    onError: (err) => showToast(errorMessage(err, 'Could not save settings.'), 'error'),
  });

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleSave() {
    saveMutation.mutate({
      voice_id: form.voice_id,
      tts_model: form.tts_model,
      stability: form.stability,
      similarity: form.similarity,
      speed_cap: form.speed_cap,
      words_per_sec: form.words_per_sec,
      style_sample: form.style_sample,
      glossary: form.glossary,
    });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Settings</h1>
        {readOnly && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Read-only &mdash; only the CEO can change these.
          </p>
        )}
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Changing voice, model, stability or similarity makes every segment regenerate on the next Generate.
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <TextField
          id="voice_id"
          label="Voice ID"
          value={form.voice_id ?? ''}
          onChange={(v) => update('voice_id', v || null)}
          readOnly={readOnly}
        />

        <div>
          <label htmlFor="tts_model" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            TTS model
          </label>
          {customModel ? (
            <input
              id="tts_model"
              type="text"
              value={form.tts_model}
              disabled={readOnly}
              onChange={(e) => update('tts_model', e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
            />
          ) : (
            <select
              id="tts_model"
              value={form.tts_model}
              disabled={readOnly}
              onChange={(e) => {
                if (e.target.value === '__other__') {
                  setCustomModel(true);
                } else {
                  update('tts_model', e.target.value);
                }
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
            >
              {MODEL_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          )}
        </div>

        <SliderField
          id="stability"
          label="Stability"
          value={form.stability}
          min={0}
          max={1}
          step={0.05}
          readOnly={readOnly}
          onChange={(v) => update('stability', v)}
        />
        <SliderField
          id="similarity"
          label="Similarity"
          value={form.similarity}
          min={0}
          max={1}
          step={0.05}
          readOnly={readOnly}
          onChange={(v) => update('similarity', v)}
        />
        <SliderField
          id="speed_cap"
          label="Speed cap"
          value={form.speed_cap}
          min={1.0}
          max={1.3}
          step={0.01}
          readOnly={readOnly}
          onChange={(v) => update('speed_cap', v)}
        />
        <SliderField
          id="words_per_sec"
          label="Words per second"
          value={form.words_per_sec}
          min={1.5}
          max={3.0}
          step={0.1}
          readOnly={readOnly}
          onChange={(v) => update('words_per_sec', v)}
        />

        <TextAreaField
          id="style_sample"
          label="Style sample"
          value={form.style_sample}
          onChange={(v) => update('style_sample', v)}
          readOnly={readOnly}
          rows={5}
        />
        <TextAreaField
          id="glossary"
          label="Glossary"
          hint="One bangla = english pair per line"
          value={form.glossary}
          onChange={(v) => update('glossary', v)}
          readOnly={readOnly}
          rows={5}
        />

        {!readOnly && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}

function TextAreaField({
  id,
  label,
  hint,
  value,
  onChange,
  readOnly,
  rows,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  rows: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      <textarea
        id={id}
        value={value}
        readOnly={readOnly}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}

function SliderField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  readOnly,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  readOnly: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <span className="text-sm text-slate-500 dark:text-slate-400">{value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block w-full disabled:opacity-50"
      />
    </div>
  );
}
