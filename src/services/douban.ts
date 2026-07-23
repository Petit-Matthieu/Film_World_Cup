import { IS_DEV } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[Douban]', ...args);

// ============================================================
// 请求工具
// ============================================================

// Cloudflare Worker 代理 URL（部署 worker.js 后填入）
// 例如: https://douban-proxy.你的用户名.workers.dev
const DOUBAN_PROXY = '';

// 免费 CORS 代理
const FALLBACK_PROXIES = [
  (u: string) => `https://cors.eu.org/${u}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(url)
      .then(r => { clearTimeout(timer); resolve(r); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

async function fetchViaProxy(url: string): Promise<Response> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www')
      .replace('https://search.douban.com', '/api/search');
    return fetch(proxyPath);
  }
  // 优先用自建代理
  if (DOUBAN_PROXY) {
    try {
      const r = await fetchWithTimeout(`${DOUBAN_PROXY}/?url=${encodeURIComponent(url)}`, 10000);
      return r;
    } catch {}
  }
  // 备用免费代理（不检查 ok，有些代理返回非200但数据正常）
  for (const p of FALLBACK_PROXIES) {
    try {
      const r = await fetchWithTimeout(p(url), 8000);
      return r; // 不管状态码，照常返回
    } catch {}
  }
  throw new Error('所有代理均不可用');
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetchViaProxy(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchViaProxy(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchSearchPage(url: string): Promise<string> {
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
  // 生产环境：走代理（带 Referer: movie.douban.com）
  if (DOUBAN_PROXY) {
    return `${DOUBAN_PROXY}/?url=${encodeURIComponent(url)}`;
  }
  // 用免费代理（cors.eu.org 实测可用）
  return `https://cors.eu.org/${url}`;
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
    const html = await fetchSearchPage(
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
// 主搜索：搜索页优先（一次请求拿大量结果+头像），suggest 备选
// ============================================================

export async function searchPerson(query: string): Promise<{ people: Person[]; movies: Movie[] }> {
  debug('searchPerson:', query);

  const movieMap = new Map<string, Movie>();
  const peopleMap = new Map<string, Person>();

  // === 搜索页（主通道：一次拿15条+头像）===
  let searchPageSuccess = false;
  try {
    const page = await searchPage(query, 0);
    if (page && page.items.length > 0) {
      searchPageSuccess = true;
      const avatar = collectFromItems(page.items, movieMap, peopleMap);
      if (avatar) {
        peopleMap.set(query, { id: `q:${query}`, name: query, department: '影人', avatarUrl: avatar });
      }
      // 第2页
      if (movieMap.size < 40 && page.total > 15) {
        const page2 = await searchPage(query, 15);
        if (page2 && page2.items.length > 0) {
          collectFromItems(page2.items, movieMap, peopleMap);
        }
      }
    }
  } catch (e) {
    debug('  搜索页失败');
  }

  // === Suggest 补充（搜索页不够时补量）===
  if (movieMap.size < 30) {
    debug(`  suggest 补充 (当前${movieMap.size}部)...`);
    const { cards: c1, words } = await suggest(query);
    const searchedQueries = new Set<string>([query]);

    function addSuggestCard(card: Card) {
      const mId = card.url.match(/subject\/(\d+)/)?.[1];
      if (!mId || movieMap.has(mId)) return;
      const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
      let rating = 0;
      if (parts[0]) { const m = parts[0].match(/([\d.]+)/); if (m) rating = parseFloat(m[1]); }
      movieMap.set(mId, makeMovie(mId, card.title, card.cover_url, rating, 0, card.year || ''));
    }

    for (const card of c1) addSuggestCard(card);

    // 收集所有搜索词（words + 额外组合），不限数量，全并行
    const extraQueries = words.filter(w => w && !w.includes(' ') && w.length >= 2 && w !== query);
    const comboQueries = [`${query} 电影`, `${query} 导演`, `${query} 演员`, `${query} 作品`];
    const allQueries = [...new Set([...extraQueries, ...comboQueries])]
      .filter(w => w && !searchedQueries.has(w))
      .slice(0, 20);

    if (allQueries.length > 0) {
      await Promise.all(allQueries.map(async (q) => {
        if (searchedQueries.has(q)) return;
        searchedQueries.add(q);
        try {
          const { cards } = await suggest(q);
          for (const card of cards) addSuggestCard(card);
        } catch {}
      }));
      debug(`  suggest后: ${movieMap.size} 部`);
    }
  }

  // === 去重 ===
  const dedupedMovies = new Map<string, Movie>();
  for (const movie of movieMap.values()) {
    if (!movie.title) continue;
    const key = `${movie.title}|${movie.releaseYear}`;
    const existing = dedupedMovies.get(key);
    if (!existing || movie.rating > existing.rating ||
        (movie.rating === existing.rating && movie.voteCount > existing.voteCount)) {
      dedupedMovies.set(key, movie);
    }
  }

  debug(`  ${dedupedMovies.size} 部电影，${peopleMap.size} 个影人`);

  const people = [...peopleMap.values()];
  people.sort((a, b) => {
    const aM = query.includes(a.name) || a.name.includes(query);
    const bM = query.includes(b.name) || b.name.includes(query);
    return (bM ? 1 : 0) - (aM ? 1 : 0);
  });

  const movies = [...dedupedMovies.values()];
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
// 快速联想建议 — 只返回单个人名，过滤干扰项
// ============================================================

const suggestCache = new Map<string, any[]>();

// 非人名的关键词：类型、八卦等
const NON_PERSON_KEYWORDS = new Set([
  '剧情', '喜剧', '动作', '科幻', '爱情', '恐怖', '悬疑', '犯罪', '冒险', '战争',
  '动画', '纪录', '纪录片', '短片', '家庭', '奇幻', '武侠', '历史', '音乐', '歌舞',
  '运动', '传记', '情色', '古装', '黑色', '惊悚', '灾难', '儿童', '西部',
  '同性', '戏曲', '真人秀', '脱口秀', '舞台艺术',
]);

// 八卦/非作品相关词
const GOSSIP_KEYWORDS = [
  '私生子', '出轨', '离婚', '结婚', '老婆', '老公', '女友', '男友',
  '绯闻', '恋情', '小三', '去世', '死亡', '吸毒', '被捕',
];

function looksLikePersonName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 4) return false;
  // 排除包含数字、年份、特殊符号的
  if (/[\d年月日|·•《》()（）\/]/.test(s)) return false;
  // 排除类型关键词
  if (NON_PERSON_KEYWORDS.has(s)) return false;
  // 纯英文名允许（如 Nolan）
  if (/^[a-zA-Z\s.\-]+$/.test(s)) return s.length >= 3;
  // 中文名：2-4字，不应包含八卦词
  for (const kw of GOSSIP_KEYWORDS) {
    if (s.includes(kw)) return false;
  }
  return true;
}

export async function searchSuggest(query: string): Promise<any[]> {
  if (suggestCache.has(query)) return suggestCache.get(query)!;

  try {
    const { cards, words } = await suggest(query);
    const items: any[] = [];
    const seenNames = new Set<string>();

    // 优先：把用户输入的 query 本身作为第一个建议
    if (looksLikePersonName(query)) {
      seenNames.add(query);
      items.push({
        title: query,
        subTitle: '影人',
        url: `person:q:${query}`,
        type: 'person',
        image: '',
      });
    }

    // 从电影卡片中提取人名
    for (const card of cards) {
      if (card.type === 'movie' || card.type === 'tv') {
        const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
        // 只取导演/演员部分（最后几段）
        for (const p of parts.slice(-4)) {
          // 用空格/逗号分割多个人名
          p.split(/[\s,，]+/).forEach((n: string) => {
            n = n.trim();
            if (looksLikePersonName(n) && !seenNames.has(n)) {
              seenNames.add(n);
              items.push({ title: n, subTitle: '影人', url: `person:q:${n}`, type: 'person', image: '' });
            }
          });
        }
      }
    }

    // 从联想词中提取（仅取像人名的单个人名，不要复合搜索词）
    for (const w of words) {
      // 排除复合搜索词（包含空格、·等）
      if (w.includes(' ')) continue;
      if (looksLikePersonName(w) && !seenNames.has(w)) {
        seenNames.add(w);
        items.push({ title: w, subTitle: '影人', url: `person:q:${w}`, type: 'person', image: '' });
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
