import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { X, UploadCloud, Link as LinkIcon, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { readVideoDuration } from '../lib/upload';
import { formatBytes, parseDriveFileId } from '../lib/format';
import { errorMessage } from '../lib/errors';
import { useToast } from '../hooks/useToast';

interface UploadDialogProps {
  onClose: () => void;
  onCreated: (videoId: string) => void;
}

const DRIVE_INPUT_FOLDER_URL = import.meta.env.VITE_DRIVE_INPUT_FOLDER_URL;

function titleFromFileName(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, '');
  return withoutExt.replace(/[_-]+/g, ' ').trim();
}

export function UploadDialog({ onClose, onCreated }: UploadDialogProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'upload' | 'drive-link'>('upload');

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [uploadFallback, setUploadFallback] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const [driveInput, setDriveInput] = useState('');
  const [driveTitle, setDriveTitle] = useState('');
  const [submittingLink, setSubmittingLink] = useState(false);

  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploading]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setUploadFallback(false);
    if (f && !title) setTitle(titleFromFileName(f.name));
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadFallback(false);
    setProgress({ loaded: 0, total: file.size });

    try {
      const durationSec = await readVideoDuration(file);
      const { uploadUrl } = await api.createUploadSession(file.name, file.type, file.size);

      const handle = api.uploadFile(uploadUrl, file, (loaded, total) => setProgress({ loaded, total }));
      abortRef.current = handle.abort;

      let driveFileId: string;
      try {
        const result = await handle.promise;
        driveFileId = result.id;
      } catch (err) {
        if (errorMessage(err) === 'aborted') {
          setUploading(false);
          setProgress(null);
          return;
        }
        setUploadFallback(true);
        setUploading(false);
        return;
      }

      const { videoId } = await api.notifyVideoUploaded({
        driveFileId,
        title: title.trim() || titleFromFileName(file.name),
        durationSec,
      });

      onCreated(videoId);
      onClose();
    } catch (err) {
      showToast(errorMessage(err, 'Could not start the upload.'), 'error');
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    abortRef.current?.();
    abortRef.current = null;
    setUploading(false);
    setProgress(null);
  }

  async function handleDriveLinkSubmit() {
    const id = parseDriveFileId(driveInput);
    if (!id) {
      showToast('Could not find a Drive file ID in that link. Paste the full share link or the file ID.', 'error');
      return;
    }
    if (!driveTitle.trim()) {
      showToast('Give the video a title.', 'error');
      return;
    }
    setSubmittingLink(true);
    try {
      const { videoId } = await api.notifyVideoUploaded({
        driveFileId: id,
        title: driveTitle.trim(),
        durationSec: null,
      });
      onCreated(videoId);
      onClose();
    } catch (err) {
      showToast(errorMessage(err, 'Could not register that video.'), 'error');
    } finally {
      setSubmittingLink(false);
    }
  }

  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">New video</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            disabled={uploading}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium',
              tab === 'upload' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <UploadCloud size={15} /> Upload file
          </button>
          <button
            type="button"
            onClick={() => setTab('drive-link')}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium',
              tab === 'drive-link' ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            <LinkIcon size={15} /> Add from Drive link
          </button>
        </div>

        {tab === 'upload' ? (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="video-file" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Video file
              </label>
              <input
                id="video-file"
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={handleFileChange}
                disabled={uploading}
                className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100 dark:text-slate-200 dark:file:bg-slate-700 dark:file:text-slate-200"
              />
            </div>
            <div>
              <label htmlFor="video-title" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Title
              </label>
              <input
                id="video-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                placeholder="e.g. Customer Onboarding Walkthrough"
              />
            </div>

            {uploading && progress && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full bg-blue-600 transition-[width]" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {pct}% &middot; {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                </p>
              </div>
            )}

            {uploadFallback && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Direct upload failed. Put the file in the Drive Input folder and use &quot;Add from Drive link&quot;
                instead.
                {DRIVE_INPUT_FOLDER_URL && (
                  <>
                    {' '}
                    <a
                      href={DRIVE_INPUT_FOLDER_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline"
                    >
                      Open Input folder <ExternalLink size={12} />
                    </a>
                  </>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {uploading ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel upload
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!file || !title.trim()}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Upload
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="drive-link" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Drive file link or ID
              </label>
              <input
                id="drive-link"
                type="text"
                value={driveInput}
                onChange={(e) => setDriveInput(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="drive-link-title" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Title
              </label>
              <input
                id="drive-link-title"
                type="text"
                value={driveTitle}
                onChange={(e) => setDriveTitle(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDriveLinkSubmit}
                disabled={submittingLink}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submittingLink ? 'Adding…' : 'Add video'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
