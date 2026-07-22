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
// 自动联想（suggest API — 返回电影为主）
// ============================================================

interface SuggestItem {
  title: string; subTitle: string; url: string; type: string; image: string;
}

export async function searchSuggest(query: string): Promise<SuggestItem[]> {
  const q = query.trim();
  if (!q || q.length < 1) return [];

  const url = `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(q)}`;
  try {
    const data = await fetchJSON(url);
    if (!data) return [];
    const cards: any[] = Array.isArray(data) ? data : (data.cards || []);
    return cards.map((item: any) => {
      const u = item.url || '';
      return {
        title: item.title || item.name || '',
        subTitle: item.sub_title || item.subtitle || item.abstract || '',
        url: u,
        type: u.includes('/celebrity/') ? 'celebrity' : 'movie',
        image: item.pic || item.cover_url || item.cover || '',
      };
    }).filter((s: SuggestItem) => s.title && s.url).slice(0, 10);
  } catch { return []; }
}

// ============================================================
// 从电影页提取导演/演员
// ============================================================

export async function getDirectorsFromMovie(movieId: string): Promise<Person[]> {
  debug('getDirectorsFromMovie:', movieId);
  const people: Person[] = [];
  const seen = new Set<string>();

  try {
    const html = await fetchText(`https://movie.douban.com/subject/${movieId}/`);
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 策略1：标准 rel 属性
    for (const rel of ['v:directedBy', 'v:starring']) {
      doc.querySelectorAll(`a[rel="${rel}"]`).forEach((link) => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/(?:celebrity|personage)\/(\d+)/);
        const name = (link.textContent || '').trim();
        if (idMatch && name && !seen.has(idMatch[1])) {
          seen.add(idMatch[1]);
          people.push({ id: idMatch[1], name,
            department: rel === 'v:directedBy' ? '导演' : '演员', avatarUrl: null });
        }
      });
    }

    // 策略2：#info 区域的所有影人链接
    if (people.length === 0) {
      const infoEl = doc.querySelector('#info');
      if (infoEl) {
        infoEl.querySelectorAll('a[href*="/celebrity/"], a[href*="/personage/"]').forEach((link) => {
          const href = link.getAttribute('href') || '';
          const idMatch = href.match(/(?:celebrity|personage)\/(\d+)/);
          const name = (link.textContent || '').trim();
          if (idMatch && name && !seen.has(idMatch[1])) {
            seen.add(idMatch[1]);
            const label = (link.parentElement?.textContent || '').trim();
            const dept = label.startsWith('导演') ? '导演' : label.startsWith('主演') ? '演员' : '影人';
            people.push({ id: idMatch[1], name, department: dept, avatarUrl: null });
          }
        });
      }
    }

    // 策略3：全页扫描（最暴力但最可靠）
    if (people.length === 0) {
      doc.querySelectorAll('a[href*="/celebrity/"], a[href*="/personage/"]').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const idMatch = href.match(/(?:celebrity|personage)\/(\d+)/);
        const name = (link.textContent || '').trim();
        if (idMatch && name && name.length >= 2 && name.length <= 30 && !seen.has(idMatch[1])) {
          seen.add(idMatch[1]);
          people.push({ id: idMatch[1], name, department: '影人', avatarUrl: null });
        }
      });
    }

    debug('提取到', people.length, '位影人:', people.map((p) => p.name));
  } catch (err: any) {
    warn('getDirectorsFromMovie 失败:', err.message);
  }

  return people;
}

// ============================================================
// 搜索影人 = suggest 中的影人 + 从电影页提取
// ============================================================

export async function searchPerson(query: string): Promise<Person[]> {
  debug('searchPerson:', query);
  const people: Person[] = [];
  const seen = new Set<string>();

  const suggestions = await searchSuggest(query);

  // 直接影人
  for (const item of suggestions) {
    const cMatch = item.url.match(/(?:celebrity|personage)\/(\d+)/);
    if (cMatch && !seen.has(cMatch[1])) {
      seen.add(cMatch[1]);
      people.push({ id: cMatch[1], name: item.title,
        department: item.subTitle || '影人', avatarUrl: getImageUrl(item.image || null) });
    }
  }

  // 自动从前3部电影提取导演/演员，按出现频率排序
  if (people.length === 0) {
    const movies = suggestions.filter((s) => s.url.includes('/subject/')).slice(0, 3);
    const freq = new Map<string, { person: Person; count: number }>();

    for (const movie of movies) {
      const mId = movie.url.match(/subject\/(\d+)/)?.[1];
      if (!mId) continue;
      const directors = await getDirectorsFromMovie(mId);
      for (const d of directors) {
        if (freq.has(d.id)) {
          freq.get(d.id)!.count++;
        } else {
          freq.set(d.id, { person: d, count: 1 });
        }
      }
    }

    // 按频率排序（同一导演出现多次说明更相关）
    const sorted = [...freq.values()].sort((a, b) => b.count - a.count);
    for (const { person, count } of sorted) {
      debug('  ', person.name, `(${person.department}) ×${count}`);
      people.push(person);
    }
  }

  debug('共找到', people.length, '位影人');
  return people.slice(0, 20);
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
        debug('解析到', films.length, '部电影');
        return films;
      }
    } catch (err: any) { warn(url, err.message); }
  }
  return [];
}

function parseFilmList(doc: Document): Movie[] {
  const films: Movie[] = [];
  const seen = new Set<string>();
  const links = doc.querySelectorAll('a[href*="/subject/"]');

  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.includes('/celebrity/') || href.includes('/photo/') || href.includes('/trailer/')) continue;
    const idMatch = href.match(/subject\/(\d+)/);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;
    seen.add(id);

    let title = link.getAttribute('title') || link.textContent?.trim() || '';
    if (title.length > 80 || !title) {
      const parent = link.closest('li, .item, [class*="item"], div');
      if (parent) {
        const h = parent.querySelector('.title, [class*="title"], h3');
        if (h) title = (h.textContent || '').trim();
      }
      if (!title) title = (link.textContent || '').trim();
    }
    title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.length > 80 || title.length < 1 || /查看更多|全部|影人|照片/.test(title)) continue;

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
  }

  films.sort((a, b) => b.popularity - a.popularity);
  return films.slice(0, MAX_FILMS);
}
