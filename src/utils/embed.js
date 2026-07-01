// Utilities for parsing and resolving embed URLs for various providers
export const PROVIDER_LABELS = {
  vidsrc: 'VS.TO',
  'vidsrc.su': 'VS.SU',
  'vidsrc.cc': 'VS.CC',
  'vidsrc.me': 'VS.ME',
  'vidsrc.xyz': 'VS.XYZ',
  multiembed: 'MULTI',
  vidlink: 'VIDLINK',
  vidking: 'VIDKING',
};

export const parseEmbedUrl = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return null;

  try {
    const absoluteUrlStr = urlStr.startsWith('//') ? `https:${urlStr}` : urlStr;
    const url = new URL(absoluteUrlStr);
    let id = '';
    let type = 'movie';
    let season = '1';
    let episode = '1';

    if (url.hostname.includes('multiembed.mov')) {
      const videoId = url.searchParams.get('video_id');
      const s = url.searchParams.get('s');
      const e = url.searchParams.get('e');
      if (videoId) {
        id = videoId;
        if (s && e) {
          type = 'tv';
          season = s;
          episode = e;
        } else {
          type = 'movie';
        }
        return { id, type, season, episode };
      }
    }

    const pathname = url.pathname;
    const parts = pathname.split('/').filter(Boolean);

    const movieIdx = parts.indexOf('movie');
    const tvIdx = parts.indexOf('tv');

    if (movieIdx !== -1 && parts.length > movieIdx + 1) {
      id = parts[movieIdx + 1];
      type = 'movie';
      return { id, type, season, episode };
    } else if (tvIdx !== -1 && parts.length > tvIdx + 1) {
      id = parts[tvIdx + 1];
      type = 'tv';
      if (parts.length > tvIdx + 2) season = parts[tvIdx + 2];
      if (parts.length > tvIdx + 3) episode = parts[tvIdx + 3];
      return { id, type, season, episode };
    }

    const imdbMatch = pathname.match(/tt\d+/);
    if (imdbMatch) {
      id = imdbMatch[0];
      const afterImdb = parts.slice(parts.indexOf(id) + 1);
      if (afterImdb.length >= 2 && !isNaN(afterImdb[0]) && !isNaN(afterImdb[1])) {
        type = 'tv';
        season = afterImdb[0];
        episode = afterImdb[1];
      } else {
        type = 'movie';
      }
      return { id, type, season, episode };
    }

    return null;
  } catch (e) {
    return null;
  }
};

export const getLocalEmbedUrl = (url, provider) => {
  const info = parseEmbedUrl(url);
  if (!info) return url;

  const { id, type, season, episode } = info;

  if (type === 'movie') {
    if (provider === 'vidsrc' || provider === 'vidsrc.to') {
      return `https://vidsrc.su/embed/movie/${id}`;
    }
    if (provider === 'vidsrc.su') {
      return `https://vidsrc.su/embed/movie/${id}`;
    }
    if (provider === 'vidsrc.cc') {
      return `https://vidsrc.cc/v2/embed/movie/${id}`;
    }
    if (provider === 'vidsrc.me') {
      return `https://vidsrcme.ru/embed/movie/${id}`;
    }
    if (provider === 'vidsrc.xyz') {
      return `https://vidsrc-embed.su/embed/movie/${id}`;
    }
    if (provider === 'multiembed') {
      return `https://multiembed.mov/?video_id=${id}`;
    }
    if (provider === 'vidlink') {
      return `https://vidlink.pro/movie/${id}`;
    }
    if (provider === 'vidking') {
      return `https://www.vidking.net/embed/movie/${id}?color=e50914&autoPlay=true`;
    }
    return `https://vidsrc.su/embed/movie/${id}`;
  } else {
    if (provider === 'vidsrc' || provider === 'vidsrc.to') {
      return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'vidsrc.su') {
      return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'vidsrc.cc') {
      return `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'vidsrc.me') {
      return `https://vidsrcme.ru/embed/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'vidsrc.xyz') {
      return `https://vidsrc-embed.su/embed/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'multiembed') {
      return `https://multiembed.mov/?video_id=${id}&tmdb=0&s=${season}&e=${episode}`;
    }
    if (provider === 'vidlink') {
      return `https://vidlink.pro/tv/${id}/${season}/${episode}`;
    }
    if (provider === 'vidking') {
      return `https://www.vidking.net/embed/tv/${id}/${season}/${episode}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
    }
    return `https://vidsrc.su/embed/tv/${id}/${season}/${episode}`;
  }
};

export default { parseEmbedUrl, getLocalEmbedUrl, PROVIDER_LABELS };
