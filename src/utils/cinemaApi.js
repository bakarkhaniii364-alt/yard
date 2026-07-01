/**
 * Cinema / SyncWatcher API helpers — centralizes external fetch URLs for CSP audits.
 */

export async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${new URL(url).hostname}`);
  }
  return res.json();
}

export async function searchTVmaze(query) {
  try {
    const data = await fetchJson(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`
    );
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({
      id: item.show.id,
      title: item.show.name,
      year: item.show.premiered ? new Date(item.show.premiered).getFullYear() : 'N/A',
      poster: item.show.image?.medium || item.show.image?.original || '',
      type: 'tv',
      imdbId: item.show.externals?.imdb || '',
      summary: item.show.summary,
    }));
  } catch (err) {
    console.error('TVmaze search failed:', err);
    return [];
  }
}

export async function searchIMDbProxy(query) {
  try {
    const data = await fetchJson(
      `https://imdb.iamidiotareyoutoo.com/search?q=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; YardArcade/1.0)',
        },
      }
    );
    if (!data?.ok || !Array.isArray(data.description)) return [];
    return data.description.map((item) => ({
      id: item['#IMDB_ID'],
      title: item['#TITLE'],
      year: item['#YEAR'] || 'N/A',
      poster: item['#IMG_POSTER'] || '',
      type:
        item['#TYPE'] === 'tvSeries' || item['#TYPE'] === 'tvMiniSeries' ? 'tv' : 'movie',
      actors: item['#ACTORS'],
    }));
  } catch (err) {
    console.error('IMDb proxy search failed, falling back to TMDB:', err);
    const tmdbKey = import.meta.env.VITE_TMDB_API_KEY;
    if (tmdbKey) {
      return searchTMDB(query, tmdbKey);
    }
    return [];
  }
}

export async function searchTMDB(query, apiKey) {
  const data = await fetchJson(
    `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}`
  );
  if (!data?.results) return [];
  return data.results
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => ({
      id: item.id,
      title: item.title || item.name,
      year: item.release_date
        ? new Date(item.release_date).getFullYear()
        : item.first_air_date
          ? new Date(item.first_air_date).getFullYear()
          : 'N/A',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
      type: item.media_type,
      overview: item.overview,
    }));
}

export async function fetchTVmazeEpisodes(showId) {
  try {
    return await fetchJson(`https://api.tvmaze.com/shows/${showId}/episodes`);
  } catch {
    return [];
  }
}

export async function fetchTVmazeShow(showId) {
  try {
    return await fetchJson(`https://api.tvmaze.com/shows/${showId}`);
  } catch {
    return null;
  }
}

export async function lookupTVmazeByImdb(imdbId) {
  try {
    return await fetchJson(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
  } catch {
    return null;
  }
}

/** User-facing message when fetch fails (CSP, network, API down). */
export function cinemaFetchErrorMessage(err) {
  const msg = err?.message || String(err);
  if (msg.includes('Content Security Policy') || msg.includes('Failed to fetch')) {
    return 'Search blocked by browser policy. Redeploy the latest site build or check public/_headers connect-src.';
  }
  return 'Search failed. Check your connection and try again.';
}
