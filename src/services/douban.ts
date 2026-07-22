import { IS_DEV } from '../constants';
import type { Person, Movie } from '../types';

const debug = (...args: unknown[]) => console.log('[Douban]', ...args);

// ============================================================
// 请求豆瓣 JSON API（不受反爬影响）
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
  // 生产：CORS 代理
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
// 图片代理
// ============================================================

function imgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (IS_DEV) {
    return url
      .replace('https://img1.doubanio.com', '/api/img')
      .replace('https://img2.doubanio.com', '/api/img2')
      .replace('https://img3.doubanio.com', '/api/img3')
      .replace(/https:\/\/img\d+.doubanio.com/, '/api/img');
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&output=webp`;
}

// ============================================================
// Suggest API 返回的电影卡片
// ============================================================

interface Card {
  title: string;
  url: string;
  cover_url: string;
  card_subtitle: string;
  year: string;
  type: string;
}

function parseCards(data: any): Card[] {
  if (!data) return [];
  const cards = Array.isArray(data) ? data : (data.cards || []);
  return cards.filter((c: any) => c.url?.includes('/subject/'));
}

// ============================================================
// 搜索影人 + 电影
// ============================================================

export interface SearchResult {
  people: Person[];
  movies: Movie[];
}

export async function searchPerson(query: string): Promise<SearchResult> {
  debug('searchPerson:', query);
  const result: SearchResult = { people: [], movies: [] };
  const seenPeople = new Set<string>();
  const seenMovies = new Set<string>();

  try {
    // 获取 suggest 卡片
    const data = await fetchJSON(
      `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(query)}`
    );
    const cards = parseCards(data);
    // 也有相关搜索词
    const words: string[] = data?.words || [];

    // 合并主结果 + 第一个相关词的搜索结果
    const allCards = [...cards];
    if (words.length > 0 && cards.length < 20) {
      try {
        const data2 = await fetchJSON(
          `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(words[0])}`
        );
        allCards.push(...parseCards(data2));
      } catch {}
    }

    debug('获取到', allCards.length, '个电影卡片');

    for (const card of allCards) {
      // 解析电影
      const mId = card.url.match(/subject\/(\d+)/)?.[1];
      if (mId && !seenMovies.has(mId)) {
        seenMovies.add(mId);

        // 从 card_subtitle 解析评分: "8.5 / 2000 / ..."
        const parts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
        let rating = 0;
        if (parts[0] && /^[\d.]+$/.test(parts[0])) rating = parseFloat(parts[0]);

        result.movies.push({
          id: mId,
          title: card.title,
          posterUrl: imgUrl(card.cover_url),
          rating: Math.round(rating * 10) / 10,
          voteCount: 0,
          releaseYear: card.year || '',
          popularity: rating * 100,
        });
      }

      // 从 subtitle 提取影人名称
      // 格式: "评分 / 年份 / 国家 / 类型 / 导演名 / 演员名1 演员名2..."
      const subtitleParts = (card.card_subtitle || '').split(/\s*\/\s*/).map((s: string) => s.trim());
      // 最后两部分通常是导演和演员
      const personParts = subtitleParts.slice(-2);
      for (const name of personParts) {
        const names = name.split(/\s+/).filter((n: string) => n.length >= 2 && n.length <= 6);
        for (const n of names) {
          if (!seenPeople.has(n) && !/[\d年月日]/.test(n)) {
            seenPeople.add(n);
            result.people.push({
              id: `search:${n}`,
              name: n,
              department: '影人',
              avatarUrl: null,
            });
          }
        }
      }
    }

    // 按与搜索词的相关性排序影人
    result.people.sort((a, b) => {
      const aMatch = a.name.includes(query) || query.includes(a.name);
      const bMatch = b.name.includes(query) || query.includes(b.name);
      return (bMatch ? 1 : 0) - (aMatch ? 1 : 0);
    });

  } catch (e: any) {
    debug('搜索失败:', e.message);
  }

  return result;
}

// ============================================================
// 获取影人作品（通过搜索影人名获取更多电影）
// ============================================================

export async function getPersonFilms(personName: string): Promise<Movie[]> {
  debug('getPersonFilms:', personName);

  // 用影人名搜索，获取相关电影
  const result = await searchPerson(personName);
  return result.movies;
}

// ============================================================
// 兼容旧接口
// ============================================================

export async function searchSuggest(query: string): Promise<any[]> {
  const result = await searchPerson(query);
  return result.people.map((p) => ({
    title: p.name,
    subTitle: p.department,
    url: `person:${p.id}`,
    type: 'person',
    image: p.avatarUrl || '',
  }));
}

export async function getDirectorsFromMovie(_movieId: string): Promise<Person[]> {
  return []; // 不再需要此功能
}
