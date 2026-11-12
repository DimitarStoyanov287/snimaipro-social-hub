const TAG = /#([\p{L}\p{N}\p{M}_]*\p{L}[\p{L}\p{N}\p{M}_]*)/gu;

/** Lowercase hashtags without the leading #, de-duplicated, in order of appearance. */
export function parseHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const seen = new Set<string>();
  for (const m of caption.matchAll(TAG)) seen.add(m[1]!.toLowerCase());
  return [...seen];
}
