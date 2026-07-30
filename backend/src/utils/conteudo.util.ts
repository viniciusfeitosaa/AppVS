import crypto from 'crypto';

/** Extrai videoId de URLs youtube.com / youtu.be / youtube.com/embed. */
export function parseYoutubeUrl(raw: string): { videoId: string; canonicalUrl: string } {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    throw { statusCode: 400, message: 'Informe o link do YouTube.' };
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    throw { statusCode: 400, message: 'Link do YouTube inválido.' };
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = url.pathname.replace(/^\//, '').split('/')[0] || '';
  } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.slice('/embed/'.length).split('/')[0] || '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.slice('/shorts/'.length).split('/')[0] || '';
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.slice('/live/'.length).split('/')[0] || '';
    } else {
      videoId = url.searchParams.get('v') || '';
    }
  } else {
    throw { statusCode: 400, message: 'Use um link do YouTube (youtube.com ou youtu.be).' };
  }

  videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  if (videoId.length < 6) {
    throw { statusCode: 400, message: 'Não foi possível identificar o vídeo no link do YouTube.' };
  }

  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export function newConteudoToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function youtubeEmbedUrl(videoId: string | null | undefined): string | null {
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
