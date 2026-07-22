import { IS_DEV, getImageUrl, MAX_FILMS } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => {
  if (IS_DEV) console.log('[Douban]', ...args);
};

// ============================================================
// 底层请求：开发走 Vite 代理，生产走 CORS 代理
// ============================================================

async function fetchText(url: string): Promise<string> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');
    debug('fetch:', url, '→', proxyPath);
    const res = await fetch(proxyPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  // 生产：CORS 代理
  const corsProxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];
  for (const proxy of corsProxies) {
    try {
      const res = await fetch(proxy(url));
      if (res.ok) return await res.text();
    } catch { continue; }
  }
  throw new Error('所有代理均不可用');
}

async function fetchJSON(url: string): Promise<any> {
  const text = await fetchText(url);
  try {
    return JSON.parse(text);
  } catch {
    // 可能返回的是 HTML（被重定向），返回空
    debug('JSON parse failed, got HTML instead of JSON for:', url);
    return null;
  }
}

// ============================================================
// 自动联想搜索
// ============================================================

interface SuggestItem {
  title: string;
  subTitle: string;
  url: string;
  type: string;
  image: string;
}

export async function searchSuggest(query: string): Promise<SuggestItem[]> {
  const q = query.trim();
  if (!q || q.length < 1) return [];

  debug('suggest:', q);

  // 尝试多个 API 端点
  const endpoints = [
    `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(q)}`,
    `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(q)}`,
  ];

  for (const url of endpoints) {
    try {
      const data = await fetchJSON(url);
      if (!data || !Array.isArray(data)) continue;

      debug('suggest results:', data.length, 'items from', url);

      const items = data
        .filter((item: any) => {
          const type = item.type || '';
          const ep = item.ep || ''; // 豆瓣有时用 ep 字段
          return (
            type === 'celebrity' || type === 'celebrities' ||
            type === 'movie' || type === 'tv' || ep === 'movie' || ep === 'tv' ||
            item.url?.includes('/celebrity/') || item.url?.includes('/subject/')
          );
        })
        .map((item: any) => ({
          title: item.title || item.name || '',
          subTitle: item.sub_title || item.subtitle || item.info || item.type_name || '',
          url: item.url || '',
          type: item.type || item.ep || '',
          image: item.pic || item.cover || item.img || '',
        }))
        .filter((item: SuggestItem) => item.title && item.url)
        .slice(0, 10);

      if (items.length > 0) return items;
    } catch (err) {
      debug('suggest endpoint failed:', url, err);
      continue;
    }
  }

  return [];
}

export function suggestToPerson(item: SuggestItem): Person | null {
  const idMatch = item.url.match(/celebrity\/(\d+)/);
  if (!idMatch) return null;
  return {
    id: idMatch[1],
    name: item.title,
    department: item.subTitle || '影人',
    avatarUrl: getImageUrl(item.image || null),
  };
}

// ============================================================
// 搜索影人（HTML 解析 - 备选方案）
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);

  // 先用 suggest API
  const suggestions = await searchSuggest(query);
  const people: Person[] = [];

  for (const item of suggestions) {
    if (item.type === 'celebrity' || item.type === 'celebrities' || item.url.includes('/celebrity/')) {
      const person = suggestToPerson(item);
      if (person) people.push(person);
    }
  }

  if (people.length > 0) return people;

  // 备选：HTML 搜索页
  try {
    const url = `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1002`;
    const html = await fetchText(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 查找所有含影人链接的 <a> 标签
    const allLinks = doc.querySelectorAll('a[href*="/celebrity/"]');
    const seen = new Set<string>();

    allLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/celebrity\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      const name = (link.textContent || '').trim();
      if (!name || name.length > 60) return;

      // 向上找父元素获取头像
      const parent = link.closest('.result, .item, li, [class*="result"]');
      let avatarUrl: string | null = null;
      let department = '影人';

      if (parent) {
        const imgEl = parent.querySelector('img');
        avatarUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || null;

        const descEl = parent.querySelector('.subject-cast, .meta, [class*="desc"], p');
        if (descEl) department = (descEl.textContent || '').trim().slice(0, 60) || '影人';
      }

      people.push({ id, name, department, avatarUrl: getImageUrl(avatarUrl) });
    });

    debug('HTML parse found:', people.length, 'people');
  } catch (err) {
    debug('HTML search failed:', err);
  }

  return people.slice(0, 20);
}

// ============================================================
// 获取影人作品列表
// ============================================================

export async function getPersonFilms(personId: string): Promise<Movie[]> {
  debug('getPersonFilms:', personId);

  // 移动端页面：按评分排序
  const url = `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic&sortby=vote`;
  const html = await fetchText(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const films: Movie[] = [];
  const seen = new Set<string>();

  const movieLinks = doc.querySelectorAll('a[href*="/subject/"]');

  movieLinks.forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      if (href.includes('/celebrity/')) return;

      const idMatch = href.match(/subject\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      let title = link.getAttribute('title') || link.textContent?.trim() || '';
      title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (title.length > 80 || title.length < 1) return;
      if (title.includes('http') || title.includes('更多')) return;

      const parent = link.closest('li') || link.closest('.item') || link.parentElement;
      let rating = 0;
      let voteCount = 0;
      let releaseYear = '';
      let posterUrl: string | null = null;

      if (parent) {
        const text = parent.textContent || '';

        // 评分
        const rMatch = text.match(/([\d.]+)\s*分/) || parent.querySelector('.rating_nums, [class*="rating"]')?.textContent?.match(/([\d.]+)/);
        if (rMatch) rating = parseFloat(rMatch[1]);

        // 评价人数
        const vMatch = text.match(/\((\d+)\s*人/);
        if (vMatch) voteCount = parseInt(vMatch[1]);

        // 年份
        const yMatch = text.match(/(\d{4})/);
        if (yMatch) releaseYear = yMatch[1];

        // 海报
        const imgEl = parent.querySelector('img');
        const src = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
        if (src && !src.includes('celebrity') && !src.includes('icon')) {
          posterUrl = src;
        }
      }

      const popularity = rating * Math.log10(Math.max(voteCount, 10));

      films.push({
        id,
        title,
        posterUrl: getImageUrl(posterUrl),
        rating: Math.round(rating * 10) / 10,
        voteCount,
        releaseYear,
        popularity: Math.round(popularity * 100) / 100,
      });
    } catch { /* skip */ }
  });

  films.sort((a, b) => b.popularity - a.popularity);
  debug('films found:', films.length);

  return films.slice(0, MAX_FILMS);
}
