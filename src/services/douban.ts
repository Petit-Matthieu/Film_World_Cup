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
    const res = await fetch(proxyPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
  const corsProxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  for (const proxy of corsProxies) {
    try { const r = await fetch(proxy(url)); if (r.ok) return await r.text(); } catch {}
  }
  throw new Error('所有代理均不可用');
}

async function fetchJSON(url: string): Promise<any> {
  const text = await fetchText(url);
  try { return JSON.parse(text); } catch { return null; }
}

// ============================================================
// 自动联想
// ============================================================

interface SuggestItem {
  title: string; subTitle: string; url: string; type: string; image: string;
}

export async function searchSuggest(query: string): Promise<SuggestItem[]> {
  const q = query.trim();
  if (!q || q.length < 1) return [];
  try {
    const data = await fetchJSON(`https://www.douban.com/j/search_suggest?q=${encodeURIComponent(q)}`);
    if (!data) return [];
    const cards: any[] = Array.isArray(data) ? data : (data.cards || []);
    return cards.map((item: any) => {
      const u = item.url || '';
      return {
        title: item.title || '', subTitle: item.sub_title || item.abstract || '',
        url: u, type: u.includes('/celebrity/') ? 'celebrity' : 'movie',
        image: item.pic || item.cover_url || '',
      };
    }).filter((s: SuggestItem) => s.title && s.url).slice(0, 10);
  } catch { return []; }
}

// ============================================================
// 搜索影人 — 使用豆瓣 JSON API
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);
  const people: Person[] = [];
  const seen = new Set<string>();

  // 豆瓣 subject_search JSON API
  try {
    const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(query)}`;
    const data = await fetchJSON(url);
    if (Array.isArray(data)) {
      for (const item of data) {
        const ep = item.ep || item.type || '';
        const itemUrl = item.url || '';
        // 影人
        const cMatch = itemUrl.match(/(?:celebrity|personage)\/(\d+)/);
        if (cMatch && !seen.has(cMatch[1])) {
          seen.add(cMatch[1]);
          people.push({
            id: cMatch[1], name: item.title || item.name || '',
            department: item.sub_title || item.info || '影人',
            avatarUrl: getImageUrl(item.pic || item.cover_url || null),
          });
        }
      }
    }
  } catch (e) { warn('subject_suggest:', e); }

  // 如果没找到影人，从 suggest 的电影用搜索页提取
  if (people.length === 0) {
    try {
      // 搜索影人页（不是 subject_search）
      const searchHtml = await fetchText(
        `https://movie.douban.com/subject_search?search_text=${encodeURIComponent(query)}&cat=1002`
      );
      // 从 HTML 中提取 script 数据
      const scriptMatch = searchHtml.match(/window\.__DATA__\s*=\s*({.*?});/s);
      if (scriptMatch) {
        try {
          const rawData = JSON.parse(scriptMatch[1]);
          const payload = rawData.payload || rawData;
          if (payload && payload.items) {
            for (const item of payload.items) {
              const id = String(item.id || '');
              const name = item.title || item.name || '';
              if (id && name && !seen.has(id)) {
                seen.add(id);
                people.push({ id, name, department: '影人', avatarUrl: getImageUrl(item.cover_url || null) });
              }
            }
          }
        } catch {}
      }
      debug('subject_search script data:', people.length, 'results');
    } catch (e) { warn('subject_search:', e); }
  }

  // 自动从电影页提取导演
  if (people.length === 0) {
    const suggestions = await searchSuggest(query);
    const movies = suggestions.filter((s) => s.url.includes('/subject/')).slice(0, 2);

    for (const movie of movies) {
      const mId = movie.url.match(/subject\/(\d+)/)?.[1];
      if (!mId) continue;
      try {
        const html = await fetchText(`https://movie.douban.com/subject/${mId}/`);
        // 直接从 HTML 文本中正则提取导演链接
        const dirPattern = /<a\s+href="(\/celebrity\/\d+\/)"[^>]*rel="v:directedBy"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = dirPattern.exec(html)) !== null) {
          const cId = match[1].match(/\d+/)?.[0];
          const name = match[2].trim();
          if (cId && name && !seen.has(cId)) {
            seen.add(cId);
            people.push({ id: cId, name, department: '导演', avatarUrl: null });
          }
        }
        // 也找演员
        const actPattern = /<a\s+href="(\/celebrity\/\d+\/)"[^>]*rel="v:starring"[^>]*>([^<]+)<\/a>/gi;
        while ((match = actPattern.exec(html)) !== null) {
          const cId = match[1].match(/\d+/)?.[0];
          const name = match[2].trim();
          if (cId && name && !seen.has(cId)) {
            seen.add(cId);
            people.push({ id: cId, name, department: '演员', avatarUrl: null });
          }
        }
        debug('从', movie.title, '正则提取到', people.length, '人');
        if (people.length > 0) break;
      } catch (e) { warn('movie page regex:', e); }
    }
  }

  debug('共找到', people.length, '位影人');
  return people.slice(0, 20);
}

// ============================================================
// 从电影页提取导演（供手动点击使用）
// ============================================================

export async function getDirectorsFromMovie(movieId: string): Promise<Person[]> {
  debug('getDirectorsFromMovie:', movieId);
  const people: Person[] = [];
  const seen = new Set<string>();

  try {
    const html = await fetchText(`https://movie.douban.com/subject/${movieId}/`);

    // 正则提取所有影人链接
    const celebPattern = /<a\s+href="(\/celebrity\/(\d+)\/)"[^>]*rel="v:(directedBy|starring)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = celebPattern.exec(html)) !== null) {
      const id = match[2];
      const rel = match[3];
      const name = match[4].trim();
      if (id && name && !seen.has(id)) {
        seen.add(id);
        people.push({
          id, name,
          department: rel === 'directedBy' ? '导演' : '演员',
          avatarUrl: null,
        });
      }
    }

    // 回退：找 #info 区域的任意影人链接
    if (people.length === 0) {
      const infoStart = html.indexOf('id="info"');
      const infoEnd = html.indexOf('</div>', infoStart);
      if (infoStart >= 0 && infoEnd >= 0) {
        const info = html.slice(infoStart, infoEnd + 6);
        const linkPattern = /<a\s+href="(\/celebrity\/(\d+)\/)"[^>]*>([^<]+)<\/a>/gi;
        while ((match = linkPattern.exec(info)) !== null) {
          const id = match[2];
          const name = match[3].trim();
          if (id && name && name.length >= 2 && name.length <= 30 && !seen.has(id)) {
            seen.add(id);
            people.push({ id, name, department: '影人', avatarUrl: null });
          }
        }
      }
    }

    debug('提取到:', people.map((p) => p.name));
  } catch (e: any) { warn('getDirectorsFromMovie:', e.message); }

  return people;
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
      if (films.length > 0) { debug('解析到', films.length, '部电影'); return films; }
    } catch (e: any) { warn(e.message); }
  }
  return [];
}

function parseFilmList(doc: Document): Movie[] {
  const films: Movie[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll('a[href*="/subject/"]').forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      if (href.includes('/celebrity/') || href.includes('/photo/')) return;
      const idMatch = href.match(/subject\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      let title = link.getAttribute('title') || link.textContent?.trim() || '';
      if (title.length > 80) title = title.slice(0, 80);
      title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!title || /更多|全部|影人|照片/.test(title)) return;

      const parent = link.closest('li') || link.closest('.item') || link.closest('[class*="item"]');
      const pt = parent?.textContent || link.parentElement?.textContent || '';

      let rating = 0, voteCount = 0, releaseYear = '';
      let posterUrl: string | null = null;

      const rM = pt.match(/([\d.]+)\s*分/);
      if (rM) rating = parseFloat(rM[1]);
      const vM = pt.match(/\((\d+)\s*人/);
      if (vM) voteCount = parseInt(vM[1]);
      const yM = pt.match(/\b(19|20)\d{2}\b/);
      if (yM) releaseYear = yM[0];
      if (parent) {
        const img = parent.querySelector('img');
        const src = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
        if (src && !/celebrity|icon|default|album|logo/.test(src)) posterUrl = src;
      }

      films.push({
        id, title, posterUrl: getImageUrl(posterUrl),
        rating: Math.round(rating * 10) / 10,
        voteCount, releaseYear,
        popularity: Math.round(rating * Math.log10(Math.max(voteCount, 10)) * 100) / 100,
      });
    } catch {}
  });

  films.sort((a, b) => b.popularity - a.popularity);
  return films.slice(0, MAX_FILMS);
}
