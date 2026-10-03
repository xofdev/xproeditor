/**
 * Slug for heading anchors — must match rendered heading `id` output.
 *
 * Keeps letters and digits from every script (Persian, Arabic, Cyrillic,
 * CJK, …), so non-Latin headings get meaningful, distinct anchors instead
 * of all collapsing to `heading`, `heading-1`, …
 */
export function slugifyDocHeadingId(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}_\s-]/gu, '')
        .replace(/\s+/g, '-');
}
