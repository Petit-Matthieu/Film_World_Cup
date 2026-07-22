import { IS_DEV, TMDB_API_KEY, TMDB_IMAGE_BASE, MAX_FILMS } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[TMDb]', ...args);

const BASE = IS_DEV ? '/api/tmdb' : 'https://api.themoviedb.org/3';

function authParams(): string {
  return TMDB_API_KEY ? `api_key=${TMDB_API_KEY}` : '';
}

function withAuth(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${BASE}${path}${sep}${authParams()}`;
}

function posterUrl(path: string | null, size = 'w342'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// ============================================================
// 搜索影人
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);
  try {
    const url = withAuth(`/search/person?query=${encodeURIComponent(query)}&language=zh-CN&page=1`);
    const res = await fetch(url);
    const data = await res.json();

    if (!data.results) return [];
    debug('找到', data.results.length, '位影人');

    return data.results
      .filter((r: any) => r.known_for_department === 'Directing' || r.known_for_department === 'Acting')
      .map((r: any) => ({
        id: String(r.id),
        name: r.name,
        department: r.known_for_department === 'Directing' ? '导演' : '演员',
        avatarUrl: posterUrl(r.profile_path, 'w185'),
        popularity: r.popularity || 0,
      }))
      .slice(0, 20);
  } catch (e: any) {
    debug('搜索失败:', e.message);
    return [];
  }
}

// ============================================================
// 搜索建议（实时联想）
// ============================================================

interface SuggestItem {
  title: string; subTitle: string; url: string; type: string; image: string;
}

export async function searchSuggest(query: string): Promise<SuggestItem[]> {
  const people = await searchPerson(query);
  return people.map((p) => ({
    title: p.name,
    subTitle: p.department,
    url: `person:${p.id}`,
    type: 'person',
    image: p.avatarUrl || '',
  }));
}

// ============================================================
// 获取影人作品列表
// ============================================================

export async function getPersonFilms(personId: string): Promise<Movie[]> {
  debug('getPersonFilms:', personId);
  try {
    const url = withAuth(`/person/${personId}/movie_credits?language=zh-CN`);
    const res = await fetch(url);
    const data = await res.json();

    const cast = data.cast || [];
    const crew = data.crew || [];

    // 合并 cast 和 crew，去重
    const seen = new Set<string>();
    const all: Movie[] = [];

    for (const m of [...cast, ...crew]) {
      if (seen.has(String(m.id))) continue;
      seen.add(String(m.id));

      const rating = m.vote_average || 0;
      const voteCount = m.vote_count || 0;

      all.push({
        id: String(m.id),
        title: m.title || m.original_title || '',
        posterUrl: posterUrl(m.poster_path),
        rating: Math.round(rating * 10) / 10,
        voteCount,
        releaseYear: (m.release_date || '').slice(0, 4),
        popularity: Math.round(rating * Math.log10(Math.max(voteCount, 10)) * 100) / 100,
      });
    }

    // 按人气排序
    all.sort((a, b) => b.popularity - a.popularity);
    debug('获取到', all.length, '部电影');

    return all.slice(0, MAX_FILMS);
  } catch (e: any) {
    debug('getPersonFilms 失败:', e.message);
    return [];
  }
}

// ============================================================
// 从电影提取导演（TMDb 版本）
// ============================================================

export async function getDirectorsFromMovie(movieId: string): Promise<Person[]> {
  debug('getDirectorsFromMovie:', movieId);
  try {
    const url = withAuth(`/movie/${movieId}/credits?language=zh-CN`);
    const res = await fetch(url);
    const data = await res.json();

    const people: Person[] = [];

    // 导演
    const crew = data.crew || [];
    for (const c of crew) {
      if (c.job === 'Director' || c.department === 'Directing') {
        people.push({
          id: String(c.id),
          name: c.name,
          department: '导演',
          avatarUrl: posterUrl(c.profile_path, 'w185'),
        });
      }
    }

    // 主演（前5位）
    const cast = data.cast || [];
    for (const c of cast.slice(0, 5)) {
      people.push({
        id: String(c.id),
        name: c.name,
        department: '演员',
        avatarUrl: posterUrl(c.profile_path, 'w185'),
      });
    }

    debug('提取到', people.length, '位影人');
    return people;
  } catch (e: any) {
    debug('失败:', e.message);
    return [];
  }
}
