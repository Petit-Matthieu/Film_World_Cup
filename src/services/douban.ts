import { IS_DEV } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[Douban]', ...args);

// ============================================================
// JSON API 请求
// ============================================================

async function fetchJSON(url: string): Promise<any> {
  if (IS_DEV) {
    const proxyPath = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');
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

// ============================================================
// 图片 URL 转换
// ============================================================

function imgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // 豆瓣图片域名格式：img1.doubanio.com, img2.doubanio.com, img3.doubanio.com, img9.doubanio.com
  if (IS_DEV) {
    // 匹配所有 doubanio.com 子域名
    const match = url.match(/img(\d+)\.doubanio\.com/);
    if (match) {
      const num = match[1];
      if (['1', '2', '3', '9'].includes(num)) {
        return url.replace(`https://img${num}.doubanio.com`, `/api/img${num === '1' ? '' : num}`);
      }
      return url.replace(`https://img${num}.doubanio.com`, `/api/img`);
    }
    // 其他域名也走代理
    if (url.startsWith('https://')) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
    return url;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&output=webp`;
}

// ============================================================
// 电影卡片解析
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

// ============================================================
// 单次 suggest 查询
// ============================================================

async function suggest(query: string): Promise<{ cards: Card[]; words: string[] }> {
  try {
    const data = await fetchJSON(
      `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(query)}`
    );
    return {
      cards: parseCards(data),
      words: data?.words || [],
    };
  } catch {
    return { cards: [], words: [] };
  }
}

// ============================================================
// 根据人名收集电影（多轮搜索）
// ============================================================

export async function searchPerson(query: string): Promise<{ people: Person[]; movies: Movie[] }> {
  debug('searchPerson:', query);

  // 第一轮：搜索
  const { cards: c1, words } = await suggest(query);

  // 收集所有电影
  const movieMap = new Map<string, Movie>();
  const peopleMap = new Map<string, Person>();

  function addCard(card: Card) {
    const mId = card.url.match(/subject\/(\d+)/)?.[1];
    if (!mId || movieMap.has(mId)) return;

    // 解析评分
    const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
    let rating = 0;
    if (parts[0] && /^[\d.]+$/.test(parts[0])) rating = parseFloat(parts[0]);

    movieMap.set(mId, {
      id: mId, title: card.title,
      posterUrl: imgUrl(card.cover_url),
      rating: Math.round(rating * 10) / 10,
      voteCount: 0, releaseYear: card.year || '',
      popularity: Math.round(rating * 100),
    });
  }

  function addPerson(name: string, dept = '影人') {
    if (!name || name.length < 2 || name.length > 6 || /[\d年月日]/.test(name)) return;
    if (!peopleMap.has(name)) {
      peopleMap.set(name, { id: `q:${name}`, name, department: dept, avatarUrl: null });
    }
  }

  // 处理第一轮卡片
  for (const card of c1) {
    addCard(card);
    // 提取影人
    const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
    // 最后两部分通常是导演和演员
    for (const p of parts.slice(-3)) {
      p.split(/\s+/).filter((n: string) => n.length >= 2 && n.length <= 6 && !/[\d年月日]/.test(n))
        .forEach((n: string) => addPerson(n));
    }
  }

  // 第二轮：用相关的搜索词再搜
  const secondaryQueries = words.slice(0, 2);
  for (const w of secondaryQueries) {
    const { cards: c2 } = await suggest(w);
    for (const card of c2) addCard(card);
  }

  // 第三轮：如果电影不够32，用出现在 subtitle 中的名字再搜
  if (movieMap.size < 32) {
    const topPeople = [...peopleMap.keys()].slice(0, 3);
    for (const name of topPeople) {
      if (movieMap.size >= 32) break;
      const { cards: c3 } = await suggest(name);
      for (const card of c3) addCard(card);
    }
  }

  debug(`收集到 ${movieMap.size} 部电影，${peopleMap.size} 个影人`);

  // 排列结果
  const people = [...peopleMap.values()];
  // 与搜索词最匹配的排前面
  people.sort((a, b) => {
    const aM = query.includes(a.name) || a.name.includes(query);
    const bM = query.includes(b.name) || b.name.includes(query);
    return (bM ? 1 : 0) - (aM ? 1 : 0);
  });

  const movies = [...movieMap.values()];
  movies.sort((a, b) => b.popularity - a.popularity);

  return { people: people.slice(0, 20), movies };
}

// ============================================================
// 获取影人作品
// ============================================================

export async function getPersonFilms(personName: string): Promise<Movie[]> {
  debug('getPersonFilms:', personName);
  const { movies } = await searchPerson(personName);

  // 如果不够，用简称再搜
  if (movies.length < 16) {
    const shortName = personName.replace(/[·\s·•]/g, '').slice(-3);
    if (shortName !== personName) {
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
// 联想建议
// ============================================================

export async function searchSuggest(query: string): Promise<any[]> {
  const { people } = await searchPerson(query);
  return people.map((p) => ({
    title: p.name, subTitle: p.department,
    url: `person:${p.id}`, type: 'person',
    image: p.avatarUrl || '',
  }));
}

export async function getDirectorsFromMovie(_id: string): Promise<Person[]> {
  return [];
}
