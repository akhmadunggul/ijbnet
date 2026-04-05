export interface YoutubeInfo {
  id: string;
  isShorts: boolean;
}

export function extractYoutubeId(url: string): YoutubeInfo | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');

    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? { id, isShorts: false } : null;
    }

    if (host === 'youtube.com') {
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1]?.split('/')[0];
        return id ? { id, isShorts: true } : null;
      }
      const id = u.searchParams.get('v');
      return id ? { id, isShorts: false } : null;
    }

    return null;
  } catch {
    return null;
  }
}
