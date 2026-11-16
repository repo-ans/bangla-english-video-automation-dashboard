// This algorithm must stay byte-for-byte identical to the copy running in n8n.
// Do not "fix" the null-handling or change field order — both sides must hash the same way.
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function segmentHash(
  settings: {
    voice_id: string | null;
    tts_model: string;
    stability: number | string;
    similarity: number | string;
  },
  englishText: string
): string {
  return fnv1a(
    [
      settings.voice_id,
      settings.tts_model,
      Number(settings.stability).toFixed(2),
      Number(settings.similarity).toFixed(2),
      englishText.trim(),
    ].join('|')
  );
}
