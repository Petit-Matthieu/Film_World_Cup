import { IS_DEV, getImageUrl, MAX_FILMS } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => {
  console.log('[Douban]', ...args);
};

const warn = (...args: unknown[]) => {
  console.warn('[Douban]', ...args);
};

// ============================================================
// 底层请求
// ============================================================

async function fetchText(url: string): Promise<string> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');
    debug('GET', proxyPath);
    const res = await fetch(proxyPath);
    debug('RESP', res.status, res.statusText, 'type:', res.headers.get('content-type')?.slice(0, 50));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const text = await res.text();
    debug('GOT', text.length, 'bytes, starts with:', text.slice(0, 200).replace(/\n/g, ' '));
    return text;
  }

  // 生产模式
  const corsProxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    (u: string) => `/api/proxy?url=${encodeURIComponent(u)}`,
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
    warn('期望 JSON 但收到 HTML，长度:', text.length);
    return null;
  }
}

// ============================================================
// 自动联想
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

  debug('searchSuggest:', q);

  // 豆瓣搜索建议 API
  const url = `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(q)}`;
  try {
    const data = await fetchJSON(url);
    if (!data || !Array.isArray(data)) {
      warn('suggest 返回非数组:', typeof data);
      return [];
    }

    debug('suggest 返回', data.length, '条');

    return data
      .filter((item: any) => {
        const t = item.type || item.ep || '';
        return (
          t === 'celebrity' || t === 'celebrities' ||
          t === 'movie' || t === 'tv' ||
          (item.url || '').includes('/celebrity/') ||
          (item.url || '').includes('/subject/')
        );
      })
      .map((item: any) => ({
        title: item.title || item.name || '',
        subTitle: item.sub_title || item.subtitle || item.info || '',
        url: item.url || '',
        type: item.type || item.ep || '',
        image: item.pic || item.cover || item.img || '',
      }))
      .filter((item: SuggestItem) => item.title && item.url)
      .slice(0, 10);
  } catch (err: any) {
    warn('suggest 失败:', err.message);
    return [];
  }
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
// 搜索影人
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);

  // 首选：suggest API
  const suggestions = await searchSuggest(query);
  const people: Person[] = [];
  for (const item of suggestions) {
    if (item.type === 'celebrity' || item.type === 'celebrities' || item.url.includes('/celebrity/')) {
      const person = suggestToPerson(item);
      if (person) people.push(person);
    }
  }
  if (people.length > 0) {
    debug('从 suggest 解析到', people.length, '位影人');
    return people;
  }

  // 备选：HTML 搜索页
  warn('suggest 无影人结果，尝试 HTML 解析');
  try {
    const url = `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1002`;
    const html = await fetchText(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a[href*="/celebrity/"]');
    const seen = new Set<string>();

    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/celebrity\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      const name = (link.textContent || '').trim();
      if (!name || name.length > 60) return;

      const parent = link.closest('.result, .item, li, [class*="result"]');
      let avatar: string | null = null;
      let dept = '影人';
      if (parent) {
        const img = parent.querySelector('img');
        avatar = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
        const desc = parent.querySelector('.subject-cast, .meta, p');
        if (desc) dept = (desc.textContent || '').trim().slice(0, 60);
      }
      people.push({ id, name, department: dept, avatarUrl: getImageUrl(avatar) });
    });

    debug('HTML 解析到', people.length, '位影人');
  } catch (err: any) {
    warn('HTML 搜索失败:', err.message);
  }

  return people.slice(0, 20);
}

// ============================================================
// 获取影人作品列表
// ============================================================

export async function getPersonFilms(personId: string): Promise<Movie[]> {
  debug('getPersonFilms:', personId);

  // 尝试多个 URL 格式
  const urls = [
    // 移动端：按评分排序
    `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic&sortby=vote`,
    // 移动端：默认排序
    `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic`,
    // PC端作品页
    `https://movie.douban.com/celebrity/${personId}/`,
  ];

  for (const url of urls) {
    try {
      debug('尝试:', url);
      const html = await fetchText(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const films = parseFilmList(doc);
      if (films.length > 0) {
        debug('从', url, '解析到', films.length, '部电影');
        return films;
      }
      debug('该 URL 未解析到电影');
    } catch (err: any) {
      warn(url, '失败:', err.message);
    }
  }

  warn('所有 URL 均失败');
  return [];
}

function parseFilmList(doc: Document): Movie[] {
  const films: Movie[] = [];
  const seen = new Set<string>();

  const links = doc.querySelectorAll('a[href*="/subject/"]');
  debug('parseFilmList: 找到', links.length, '个 subject 链接');

  links.forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      if (href.includes('/celebrity/') || href.includes('/photo/') || href.includes('/trailer/')) return;

      const idMatch = href.match(/subject\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      let title = link.getAttribute('title') || link.textContent?.trim() || '';
      // 如果标题不在 <a> 上，向上查找
      if (title.length > 80 || !title) {
        const parent = link.closest('li, .item, [class*="item"], div');
        if (parent) {
          const titleEl = parent.querySelector('.title, [class*="title"], h3, strong');
          if (titleEl) title = (titleEl.textContent || '').trim();
          if (!title) title = (link.textContent || '').trim();
        }
      }

      title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (title.length > 80 || title.length < 1) return;
      if (/http|更多|全部|影人|照片/.test(title)) return;

      const parent = link.closest('li') || link.closest('.item') || link.closest('[class*="item"]') || link.parentElement?.parentElement;
      const parentText = parent?.textContent || '';

      let rating = 0;
      let voteCount = 0;
      let releaseYear = '';
      let posterUrl: string | null = null;

      // 评分
      const rMatch = parentText.match(/([\d.]+)\s*分/) || parentText.match(/rating[:\s]*([\d.]+)/i);
      if (rMatch) rating = parseFloat(rMatch[1]);

      // 评价人数
      const vMatch = parentText.match(/\((\d+)\s*人/);
      if (vMatch) voteCount = parseInt(vMatch[1]);

      // 年份
      const yMatch = parentText.match(/(\d{4})/);
      if (yMatch && parseInt(yMatch[1]) >= 1900 && parseInt(yMatch[1]) <= 2030) {
        releaseYear = yMatch[1];
      }

      // 海报
      if (parent) {
        const img = parent.querySelector('img');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
        if (src && !/celebrity|icon|default|album/.test(src)) {
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
  return films.slice(0, MAX_FILMS);
}
