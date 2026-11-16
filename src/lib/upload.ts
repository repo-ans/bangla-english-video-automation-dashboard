/** Reads a video's duration client-side via an off-screen <video> element. Resolves null on failure. */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const objectUrl = URL.createObjectURL(file);
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        videoEl.removeAttribute('src');
      };

      videoEl.onloadedmetadata = () => {
        const duration = Number.isFinite(videoEl.duration) ? videoEl.duration : null;
        cleanup();
        finish(duration);
      };
      videoEl.onerror = () => {
        cleanup();
        finish(null);
      };
      videoEl.src = objectUrl;
    } catch {
      finish(null);
    }
  });
}

/**
 * Uploads `file` to a Google Drive resumable-upload URL with a single PUT via XMLHttpRequest
 * (not fetch) so upload progress is observable. No Authorization header is sent to Google.
 */
export function uploadFileToDrive(
  uploadUrl: string,
  file: File,
  onProgress: (loaded: number, total: number) => void
): { promise: Promise<{ id: string }>; abort: () => void } {
  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ id: string }>((resolve, reject) => {
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    };

    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText) as { id?: string };
          if (!data.id) {
            reject(new Error('Drive did not return a file ID for the upload.'));
            return;
          }
          resolve({ id: data.id });
        } catch {
          reject(new Error('Could not parse the upload response from Drive.'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}.`));
      }
    };

    xhr.onerror = () => reject(new Error('network-error'));
    xhr.onabort = () => reject(new Error('aborted'));

    xhr.send(file);
  });

  return { promise, abort: () => xhr.abort() };
}
