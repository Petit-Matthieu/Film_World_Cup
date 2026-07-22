import { IS_DEV, getImageUrl, MAX_FILMS } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[Douban]', ...args);
const warn = (...args: unknown[]) => console.warn('[Douban]', ...args);

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
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const text = await res.text();
    debug('GOT', text.length, 'bytes');
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
  try { return JSON.parse(text); } catch { return null; }
}

// ============================================================
// 自动联想（搜索建议）
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

  const url = `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(q)}`;
  try {
    const data = await fetchJSON(url);
    if (!data) return [];

    const cards: any[] = Array.isArray(data) ? data : (data.cards || data.items || []);
    debug('suggest:', cards.length, 'cards');

    return cards
      .map((item: any) => {
        const u = item.url || '';
        let type = item.type || item.ep || item.category || '';
        if (!type) {
          if (u.includes('/celebrity/') || u.includes('/personage/')) type = 'celebrity';
          else if (u.includes('/subject/')) type = 'movie';
        }
        return {
          title: item.title || item.name || '',
          subTitle: item.sub_title || item.subtitle || item.abstract || item.info || '',
          url: u,
          type,
          image: item.pic || item.cover_url || item.cover || item.img || '',
        };
      })
      .filter((item: SuggestItem) => item.title && item.url)
      .slice(0, 10);
  } catch (err: any) {
    warn('suggest 失败:', err.message);
    return [];
  }
}

export function suggestToPerson(item: SuggestItem): Person | null {
  const idMatch = item.url.match(/(?:celebrity|personage)\/(\d+)/);
  if (!idMatch) return null;
  return {
    id: idMatch[1],
    name: item.title,
    department: item.subTitle || '影人',
    avatarUrl: getImageUrl(item.image || null),
  };
}

// ============================================================
// 搜索影人（直接走影人专用搜索）
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);
  const people: Person[] = [];

  // 主方案：多个影人搜索 URL
  const searchUrls = [
    `https://movie.douban.com/subject_search?search_text=${encodeURIComponent(query)}&cat=1002`,
    `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1002`,
  ];

  for (const searchUrl of searchUrls) {
    if (people.length > 0) break;
    try {
      debug('尝试搜索:', searchUrl);
      const html = await fetchText(searchUrl);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      extractCelebrities(doc, people);
    } catch (err: any) {
      warn('搜索失败:', searchUrl, err.message);
    }
  }

  // 备选：suggest API（可能返回影人）
  if (people.length === 0) {
    const suggestions = await searchSuggest(query);
    for (const item of suggestions) {
      if (item.url.includes('/celebrity/') || item.url.includes('/personage/')) {
        const person = suggestToPerson(item);
        if (person) people.push(person);
      }
    }
  }

  debug('共找到', people.length, '位影人');
  return people.slice(0, 20);
}

function extractCelebrities(doc: Document, people: Person[]): void {
  const seen = new Set(people.map((p) => p.id));

  // DEBUG: dump 前 50 个链接帮助排查
  const allATags = doc.querySelectorAll('a');
  const linksSample: string[] = [];
  allATags.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (href && href.length < 200) linksSample.push(href);
  });
  debug('页面共', allATags.length, '个链接，前50个:', linksSample.slice(0, 50));

  // 多种选择器策略
  const selectorGroups = [
    // 影人卡片
    'a[href*="/celebrity/"]',
    'a[href*="/personage/"]',
    // 通用卡片内的链接
    '.celebrity-card a, .person-card a, [class*="celebrity"] a',
    // 搜索结果列表
    '.result-list a, .search-result a, .item-root a',
    // 最宽的匹配
    'a',
  ];

  for (const selector of selectorGroups) {
    if (people.length > 0) break;

    const links = doc.querySelectorAll(selector);
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const idMatch = href.match(/(?:celebrity|personage)\/(\d+)/);
      if (!idMatch) continue;
      const id = idMatch[1];
      if (seen.has(id)) continue;
      seen.add(id);

      // 姓名 — 从链接文本或 img alt 或附近元素
      let name = (link.getAttribute('title') || link.textContent || '').trim()
        .replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');

      // 从父容器找标题
      if (!name || name.length > 60) {
        const parent = link.closest('div, li, .item, [class*="item"], [class*="card"]');
        if (parent) {
          const heading = parent.querySelector('h1, h2, h3, h4, .title, [class*="title"], [class*="name"]');
          if (heading) name = (heading.textContent || '').trim();
          if (!name) name = (parent.textContent || '').trim().split(/\s+/).slice(0, 3).join(' ');
        }
      }

      if (!name || name.length < 1 || name.length > 60) continue;

      // 头像
      let avatar: string | null = null;
      const parent = link.closest('div, li, .item, [class*="item"], [class*="card"]');
      if (parent) {
        const img = parent.querySelector('img');
        avatar = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
      }
      // 如果链接本身是图片，从 src 获取
      if (!avatar) {
        const innerImg = link.querySelector('img');
        avatar = innerImg?.getAttribute('src') || innerImg?.getAttribute('data-src') || null;
      }

      // 部门
      let dept = '影人';
      if (parent) {
        const desc = parent.querySelector('.subject-cast, .meta, [class*="cast"], [class*="desc"], p, span');
        if (desc) dept = (desc.textContent || '').trim().slice(0, 60) || '影人';
      }

      people.push({ id, name, department: dept, avatarUrl: getImageUrl(avatar) });
    }
  }
}

// ============================================================
// 获取影人作品列表
// ============================================================

export async function getPersonFilms(personId: string): Promise<Movie[]> {
  debug('getPersonFilms:', personId);

  const urls = [
    `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic&sortby=vote`,
    `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic`,
    `https://movie.douban.com/celebrity/${personId}/`,
  ];

  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const films = parseFilmList(doc);
      if (films.length > 0) {
        debug('从', url.split('?')[0], '解析到', films.length, '部电影');
        return films;
      }
    } catch (err: any) {
      warn(url, '失败:', err.message);
    }
  }

  return [];
}

function parseFilmList(doc: Document): Movie[] {
  const films: Movie[] = [];
  const seen = new Set<string>();
  const links = doc.querySelectorAll('a[href*="/subject/"]');
  debug('parseFilmList:', links.length, '个 subject 链接');

  links.forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      if (href.includes('/celebrity/') || href.includes('/photo/') || href.includes('/trailer/')) return;
      const idMatch = href.match(/subject\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      // 标题
      let title = link.getAttribute('title') || link.textContent?.trim() || '';
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
      if (/http|更多|全部|影人|照片|展开/.test(title)) return;

      const parent = link.closest('li') || link.closest('.item') || link.closest('[class*="item"]');
      const pt = parent?.textContent || link.parentElement?.textContent || '';

      let rating = 0, voteCount = 0, releaseYear = '';
      let posterUrl: string | null = null;

      const rMatch = pt.match(/([\d.]+)\s*分/);
      if (rMatch) rating = parseFloat(rMatch[1]);
      const vMatch = pt.match(/\((\d+)\s*人/);
      if (vMatch) voteCount = parseInt(vMatch[1]);
      const yMatch = pt.match(/\b(19|20)\d{2}\b/);
      if (yMatch) releaseYear = yMatch[0];

      if (parent) {
        const img = parent.querySelector('img');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
        if (src && !/celebrity|icon|default|album|logo/.test(src)) posterUrl = src;
      }

      films.push({
        id, title,
        posterUrl: getImageUrl(posterUrl),
        rating: Math.round(rating * 10) / 10,
        voteCount, releaseYear,
        popularity: Math.round(rating * Math.log10(Math.max(voteCount, 10)) * 100) / 100,
      });
    } catch { /* skip */ }
  });

  films.sort((a, b) => b.popularity - a.popularity);
  return films.slice(0, MAX_FILMS);
}
