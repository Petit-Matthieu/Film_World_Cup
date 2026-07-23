import { IS_DEV } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[Douban]', ...args);

// ============================================================
// 请求工具
// ============================================================

async function fetchJSON(url: string): Promise<any> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www')
      .replace('https://search.douban.com', '/api/search');
    const res = await fetch(proxyPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
  const proxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];
  for (const p of proxies) {
    try { const r = await fetch(p(url)); if (r.ok) return await r.json(); } catch {}
  }
  throw new Error('所有代理均不可用');
}

async function fetchText(url: string): Promise<string> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www')
      .replace('https://search.douban.com', '/api/search');
    const res = await fetch(proxyPath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
  throw new Error('生产环境不支持HTML抓取');
}

// 防限流：简单延时
let lastSearchPageTime = 0;
async function rateLimitedFetch(url: string): Promise<string> {
  const now = Date.now();
  const minInterval = 1500; // 1.5秒间隔
  const wait = Math.max(0, minInterval - (now - lastSearchPageTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastSearchPageTime = Date.now();
  return fetchText(url);
}

// ============================================================
// 图片 URL
// ============================================================

function imgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (IS_DEV) {
    const match = url.match(/img(\d+)\.doubanio\.com/);
    if (match) {
      const num = match[1];
      if (['1', '2', '3', '9'].includes(num)) {
        return url.replace(`https://img${num}.doubanio.com`, `/api/img${num === '1' ? '' : num}`);
      }
      return url.replace(`https://img${num}.doubanio.com`, `/api/img`);
    }
    if (url.startsWith('https://')) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
    return url;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&output=webp`;
}

// ============================================================
// 标题解析
// ============================================================

function parseTitle(raw: string): { title: string; titleEn: string } {
  if (!raw) return { title: '', titleEn: '' };
  let cleaned = raw.replace(/[‎‏]/g, '').trim();
  cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  const cnEndMatch = cleaned.match(/^([一-鿿぀-ゟ゠-ヿ㐀-䶿切-﫿0-9\s,，、·．.·•\-—~～：:！!？?()（）《》"'']+)/);
  if (cnEndMatch && cnEndMatch[1].length < cleaned.length) {
    const cn = cnEndMatch[1].trim();
    const en = cleaned.slice(cnEndMatch[1].length).trim();
    if (en && /[a-zA-Z]/.test(en)) return { title: cn, titleEn: en };
    if (en && en.length > 0 && !/[a-zA-Z]/.test(en)) return { title: cleaned, titleEn: '' };
    return { title: cn, titleEn: '' };
  }
  return { title: cleaned, titleEn: '' };
}

function makeMovie(id: string, rawTitle: string, coverUrl: string, rating: number, voteCount: number, year: string): Movie {
  const { title, titleEn } = parseTitle(rawTitle);
  return {
    id, title, titleEn,
    posterUrl: imgUrl(coverUrl),
    rating: Math.round(rating * 10) / 10,
    voteCount,
    releaseYear: year,
    popularity: Math.round(rating * 100) + Math.log10(voteCount + 1),
  };
}

function extractYear(abstract: string): string {
  if (!abstract) return '';
  for (const p of abstract.split(/\s*\/\s*/)) {
    const ym = p.trim().match(/^(\d{4})$/);
    if (ym) return ym[1];
  }
  return '';
}

// ============================================================
// Suggest API（快速，适合多轮并行搜索）
// ============================================================

interface Card {
  title: string; url: string; cover_url: string;
  card_subtitle: string; year: string; type: string;
}

function parseCards(data: any): Card[] {
  if (!data) return [];
  const cards = Array.isArray(data) ? data : (data.cards || []);
  return cards.filter((c: any) => c.url?.includes('/subject/'));
}

async function suggest(query: string): Promise<{ cards: Card[]; words: string[] }> {
  try {
    const data = await fetchJSON(
      `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(query)}`
    );
    return { cards: parseCards(data), words: data?.words || [] };
  } catch {
    return { cards: [], words: [] };
  }
}

// ============================================================
// Search 页面（完整结果，有头像，但会被限流）
// ============================================================

interface SearchResultItem {
  title: string; id: number; cover_url: string; url: string;
  tpl_name: string;
  rating?: { value: number; count: number };
  abstract?: string;
  abstract_2?: string;
}

function parseSearchHTML(html: string): { items: SearchResultItem[]; total: number } | null {
  try {
    const start = html.indexOf('window.__DATA__ = {');
    if (start === -1) return null;
    // 从 { 开始手动计数括号
    let depth = 0;
    let i = html.indexOf('{', start);
    if (i === -1) return null;
    const jsonStart = i;
    let inString = false;
    let esc = false;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) break; }
    }
    const jsonStr = html.substring(jsonStart, i + 1);
    const data = JSON.parse(jsonStr);
    if (data.error_info && data.error_info.includes('太频繁')) {
      debug('  搜索页被限流，使用 suggest API');
      return null;
    }
    return { items: data.items || [], total: data.total || 0 };
  } catch (e) {
    debug('  parseSearchHTML error:', e);
    return null;
  }
}

// 搜索页缓存
const searchPageCache = new Map<string, { items: SearchResultItem[]; total: number }>();

async function searchPage(query: string, start = 0): Promise<{ items: SearchResultItem[]; total: number } | null> {
  const cacheKey = `${query}|${start}`;
  const cached = searchPageCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = await rateLimitedFetch(
      `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(query)}&cat=1002&start=${start}`
    );
    const result = parseSearchHTML(html);
    if (result) searchPageCache.set(cacheKey, result);
    return result;
  } catch (e) {
    debug('  searchPage error:', e);
    return null;
  }
}

// ============================================================
// 从 search items 收集电影和影人
// ============================================================

function collectFromItems(
  items: SearchResultItem[],
  movieMap: Map<string, Movie>,
  peopleMap: Map<string, Person>,
): string | null {
  let avatar: string | null = null;
  for (const item of items) {
    if (item.tpl_name === 'search_common') {
      if (item.cover_url && !avatar) {
        avatar = imgUrl(item.cover_url);
      }
      if (item.abstract_2) {
        item.abstract_2.split(/\s*\/\s*/).flatMap((s: string) =>
          s.split(/\s+/).filter((n: string) => n.length >= 2 && n.length <= 6 && !/[\d年月日]/.test(n))
        ).forEach((n: string) => {
          if (!peopleMap.has(n)) {
            peopleMap.set(n, { id: `q:${n}`, name: n, department: '影人', avatarUrl: null });
          }
        });
      }
    } else if (item.tpl_name === 'search_subject' && item.url?.includes('/subject/')) {
      const mId = String(item.id);
      if (movieMap.has(mId)) continue;
      // 跳过剧集
      const labels = (item as any).labels || [];
      if (labels.some((l: any) => l.text === '剧集')) continue;
      const movie = makeMovie(mId, item.title, item.cover_url,
        item.rating?.value || 0, item.rating?.count || 0, extractYear(item.abstract || ''));
      movieMap.set(mId, movie);
      if (item.abstract_2) {
        item.abstract_2.split(/\s*\/\s*/).slice(-5).flatMap((s: string) =>
          s.split(/\s+/).filter((n: string) => n.length >= 2 && n.length <= 6 && !/[\d年月日]/.test(n))
        ).forEach((n: string) => {
          if (!peopleMap.has(n)) {
            peopleMap.set(n, { id: `q:${n}`, name: n, department: '影人', avatarUrl: null });
          }
        });
      }
    }
  }
  return avatar;
}

// ============================================================
// 主搜索：suggest API 并行 + 搜索页补充
// ============================================================

export async function searchPerson(query: string): Promise<{ people: Person[]; movies: Movie[] }> {
  debug('searchPerson:', query);

  const movieMap = new Map<string, Movie>();
  const peopleMap = new Map<string, Person>();

  // === 第一阶段：suggest API，并行搜索所有方向 ===
  const { cards: c1, words } = await suggest(query);
  const searchedQueries = new Set<string>();
  searchedQueries.add(query);

  function addSuggestCard(card: Card) {
    const mId = card.url.match(/subject\/(\d+)/)?.[1];
    if (!mId || movieMap.has(mId)) return;
    const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
    let rating = 0;
    if (parts[0]) { const m = parts[0].match(/([\d.]+)/); if (m) rating = parseFloat(m[1]); }
    movieMap.set(mId, makeMovie(mId, card.title, card.cover_url, rating, 0, card.year || ''));
  }

  for (const card of c1) addSuggestCard(card);

  // 收集所有需要搜索的词
  const queriesToSearch = new Set<string>();
  for (const w of words) {
    if (w && w.length >= 2 && w !== query && !searchedQueries.has(w)) {
      queriesToSearch.add(w);
    }
  }
  // 额外搜索词
  for (const extra of [`${query} 电影`, `${query} 导演`, `${query} 演员`, `${query} 作品`]) {
    if (!searchedQueries.has(extra)) queriesToSearch.add(extra);
  }

  // 并行搜索所有词（最多同时8个，分批）
  const queryBatch = [...queriesToSearch].slice(0, 15);
  async function searchBatch(q: string) {
    if (searchedQueries.has(q)) return;
    searchedQueries.add(q);
    const { cards } = await suggest(q);
    for (const card of cards) addSuggestCard(card);
  }

  // 分批并行，每批最多5个，避免浏览器连接限制
  for (let i = 0; i < queryBatch.length; i += 5) {
    const batch = queryBatch.slice(i, i + 5);
    await Promise.all(batch.map(searchBatch));
  }

  debug(`  suggest阶段: ${movieMap.size} 部电影`);

  // === 第二阶段：搜索页（限流保护，只拿头像+补充结果）===
  if (movieMap.size < 30) {
    try {
      const page = await searchPage(query, 0);
      if (page && page.items.length > 0) {
        const avatar = collectFromItems(page.items, movieMap, peopleMap);
        // 设置头像
        if (avatar) {
          const matchName = [...peopleMap.keys()].find(
            n => query.includes(n) || n.includes(query)
          );
          if (matchName) {
            peopleMap.get(matchName)!.avatarUrl = avatar;
          } else {
            peopleMap.set(query, { id: `q:${query}`, name: query, department: '影人', avatarUrl: avatar });
          }
        }

        // 第二页（如果结果真的很多）
        if (movieMap.size < 30 && page.total > 15) {
          const page2 = await searchPage(query, 15);
          if (page2 && page2.items.length > 0) {
            collectFromItems(page2.items, movieMap, peopleMap);
          }
        }
      }
    } catch (e) {
      debug('  搜索页获取失败，仅使用 suggest 结果');
    }
  }

  // === 第三阶段：如果还不够，用提取到的影人名字搜 ===
  if (movieMap.size < 16) {
    const names = [...peopleMap.keys()].filter(n => n !== query).slice(0, 3);
    for (const name of names) {
      if (movieMap.size >= 16) break;
      if (searchedQueries.has(name)) continue;
      searchedQueries.add(name);
      const { cards } = await suggest(name);
      for (const card of cards) addSuggestCard(card);
    }
  }

  debug(`  最终: ${movieMap.size} 部电影，${peopleMap.size} 个影人`);

  const people = [...peopleMap.values()];
  people.sort((a, b) => {
    const aM = query.includes(a.name) || a.name.includes(query);
    const bM = query.includes(b.name) || b.name.includes(query);
    return (bM ? 1 : 0) - (aM ? 1 : 0);
  });

  const movies = [...movieMap.values()];
  movies.sort((a, b) => b.popularity - a.popularity);

  return { people: people.slice(0, 30), movies };
}

// ============================================================
// 获取影人作品
// ============================================================

export async function getPersonFilms(personName: string): Promise<Movie[]> {
  debug('getPersonFilms:', personName);
  const { movies } = await searchPerson(personName);
  if (movies.length < 16) {
    const shortName = personName.replace(/[·\s·•·]/g, '').slice(-3);
    if (shortName !== personName && shortName.length >= 2) {
      debug(`  尝试简称: "${shortName}"`);
      const { movies: m2 } = await searchPerson(shortName);
      const seen = new Set(movies.map((m: Movie) => m.id));
      for (const m of m2) {
        if (!seen.has(m.id)) { movies.push(m); seen.add(m.id); }
      }
    }
  }
  debug(`getPersonFilms 最终: ${movies.length} 部`);
  return movies;
}

// ============================================================
// 快速联想建议（带缓存，避免重复请求）
// ============================================================

const suggestCache = new Map<string, any[]>();

export async function searchSuggest(query: string): Promise<any[]> {
  if (suggestCache.has(query)) return suggestCache.get(query)!;

  try {
    const { cards, words } = await suggest(query);
    const items: any[] = [];
    const seenNames = new Set<string>();

    for (const card of cards) {
      if (card.type === 'movie' || card.type === 'tv') {
        const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
        for (const p of parts.slice(-3)) {
          p.split(/\s+/).filter((n: string) => n.length >= 2 && n.length <= 6 && !/[\d年月日]/.test(n))
            .forEach((n: string) => {
              if (!seenNames.has(n)) {
                seenNames.add(n);
                items.push({ title: n, subTitle: '影人', url: `person:q:${n}`, type: 'person', image: '' });
              }
            });
        }
      }
    }
    for (const w of words) {
      if (w.length >= 2 && w.length <= 8 && !/[\d年月日|·•]/.test(w)) {
        if (!seenNames.has(w)) {
          seenNames.add(w);
          items.push({ title: w, subTitle: '影人', url: `person:q:${w}`, type: 'person', image: '' });
        }
      }
    }

    const result = items.slice(0, 8);
    suggestCache.set(query, result);
    return result;
  } catch {
    return [];
  }
}

export async function getDirectorsFromMovie(_id: string): Promise<Person[]> {
  return [];
}
