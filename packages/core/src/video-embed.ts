export type VideoProvider = 'youtube' | 'vimeo';

export function parseVideoEmbed(url: string): { provider: VideoProvider; embedUrl: string } | null {
    const trimmed = url.trim();

    if (!trimmed) {
        return null;
    }

    const youtubePatterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
        /youtube\.com\/shorts\/([\w-]{11})/,
    ];

    for (const pattern of youtubePatterns) {
        const match = trimmed.match(pattern);

        if (match?.[1]) {
            return {
                provider: 'youtube',
                embedUrl: `https://www.youtube.com/embed/${match[1]}`,
            };
        }
    }

    const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);

    if (vimeoMatch?.[1]) {
        return {
            provider: 'vimeo',
            embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
        };
    }

    return null;
}

export function isAllowedEmbedUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        return (
            (parsed.hostname === 'www.youtube.com' && parsed.pathname.startsWith('/embed/')) ||
            (parsed.hostname === 'player.vimeo.com' && parsed.pathname.startsWith('/video/'))
        );
    } catch {
        return false;
    }
}
