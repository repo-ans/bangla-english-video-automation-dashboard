export function formatMMSS(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '--:--';
  const sec = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatMMSSTenths(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '--:--.-';
  const sec = Math.max(0, totalSeconds);
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Parses a Google Drive file URL or bare ID, returning the file ID or null. */
export function parseDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (urlMatch) return urlMatch[1];
  const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{10,}$/);
  if (idMatch) return trimmed;
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryMatch) return queryMatch[1];
  return null;
}

export function driveFileLink(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/view`;
}

export function drivePreviewLink(driveFileId: string): string {
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}
