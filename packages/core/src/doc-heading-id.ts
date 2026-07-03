/** Slug for heading anchors — must match rendered heading `id` output. */
export function slugifyDocHeadingId(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
}
