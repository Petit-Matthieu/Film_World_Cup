import { fetchDouban, fetchDoubanJSON } from './proxy';
import { getImageUrl, MAX_FILMS } from '../constants';
import type { Person, Movie } from '../types';

// ============================================================
// 自动联想搜索（实时下拉建议）
// ============================================================

interface SuggestItem {
  title: string;       // 显示名
  subTitle: string;    // 副标题（类型描述）
  url: string;         // 详情页 URL
  type: string;        // 类型：movie, celebrity, music 等
  image: string;       // 头像/海报 URL
}

/**
 * 自动联想：输入关键词，实时返回建议列表
 * 使用豆瓣搜索建议 JSON API
 */
export async function searchSuggest(query: string): Promise<SuggestItem[]> {
  if (!query.trim() || query.trim().length < 1) return [];

  try {
    // 豆瓣搜索建议 API（JSON格式）
    const url = `https://www.douban.com/j/search_suggest?q=${encodeURIComponent(query)}`;
    const data = await fetchDoubanJSON(url);

    if (!Array.isArray(data)) return [];

    return data
      .filter((item: any) => {
        // 只保留影人和电影
        const type = item.type || '';
        return (
          type === 'celebrity' ||
          type === 'celebrities' ||
          type === 'movie' ||
          type === 'tv' ||
          item.url?.includes('/celebrity/') ||
          item.url?.includes('/subject/')
        );
      })
      .map((item: any) => ({
        title: item.title || item.name || '',
        subTitle: item.sub_title || item.subtitle || item.type || '',
        url: item.url || '',
        type: item.type || (item.url?.includes('/celebrity/') ? 'celebrity' : 'movie'),
        image: item.pic || item.image || item.cover || '',
      }))
      .filter((item: SuggestItem) => item.title && item.url)
      .slice(0, 10);
  } catch (err) {
    console.warn('联想搜索失败:', err);
    return [];
  }
}

// ============================================================
// 搜索影人
// ============================================================

/**
 * 将联想结果转为 Person
 */
export function suggestToPerson(item: SuggestItem): Person | null {
  const idMatch = item.url.match(/celebrity\/(\d+)/);
  if (!idMatch) return null;

  return {
    id: idMatch[1],
    name: item.title,
    department: item.subTitle || '影人',
    avatarUrl: item.image ? getImageUrl(item.image) : null,
  };
}

/**
 * 搜索影人（从 HTML 搜索结果中解析）
 * 作为 suggest API 的补充/备选方案
 */
export async function searchPerson(query: string): Promise<Person[]> {
  try {
    // 优先通过 suggest API 获取影人结果
    const suggestions = await searchSuggest(query);
    const people: Person[] = [];

    for (const item of suggestions) {
      if (item.type === 'celebrity' || item.type === 'celebrities' || item.url.includes('/celebrity/')) {
        const person = suggestToPerson(item);
        if (person) people.push(person);
      }
    }

    if (people.length > 0) return people;

    // 备选：从搜索页 HTML 解析
    return await searchPersonFromHTML(query);
  } catch (err) {
    console.warn('搜索影人失败:', err);
    return [];
  }
}

/**
 * 从豆瓣搜索页 HTML 解析影人（备选方案）
 */
async function searchPersonFromHTML(query: string): Promise<Person[]> {
  const url = `https://www.douban.com/search?q=${encodeURIComponent(query)}&cat=1002`;
  const html = await fetchDouban(url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const results: Person[] = [];

  // 尝试多种选择器
  const selectors = [
    '.search-result .result',
    '.result-list .result',
    '.sc-bZQynM',
    '[class*="result"]',
    '.item',
    'li',
  ];

  for (const selector of selectors) {
    const items = doc.querySelectorAll(selector);
    if (items.length === 0) continue;

    for (const item of items) {
      try {
        const linkEl = item.querySelector('a[href*="celebrity"]') || item.querySelector('a[href*="/celebrity/"]');
        if (!linkEl) continue;

        const href = linkEl.getAttribute('href') || '';
        const idMatch = href.match(/celebrity\/(\d+)/);
        if (!idMatch) continue;

        const name = (linkEl.textContent || '').trim();
        if (!name || name.length > 50) continue;

        const imgEl = item.querySelector('img');
        const avatarUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || null;

        const descEl = item.querySelector('.subject-cast, .meta, p, [class*="desc"]');
        const department = (descEl?.textContent || '').trim() || '影人';

        results.push({
          id: idMatch[1],
          name,
          department: department.slice(0, 50),
          avatarUrl: getImageUrl(avatarUrl),
        });
      } catch {
        // skip broken items
      }
    }

    if (results.length > 0) break;
  }

  return results.slice(0, 20);
}

// ============================================================
// 获取影人作品列表
// ============================================================

export async function getPersonFilms(personId: string): Promise<Movie[]> {
  // 使用移动端页面，按评分排序
  const url = `https://movie.douban.com/celebrity/${personId}/movies?start=0&format=pic&sortby=vote`;
  const html = await fetchDouban(url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const films: Movie[] = [];
  const seen = new Set<string>();

  // 查找所有电影链接
  const movieLinks = doc.querySelectorAll('a[href*="/subject/"]');

  movieLinks.forEach((link) => {
    try {
      const href = link.getAttribute('href') || '';
      // 排除影人链接
      if (href.includes('/celebrity/')) return;

      const idMatch = href.match(/subject\/(\d+)/);
      if (!idMatch) return;

      const id = idMatch[1];
      if (seen.has(id)) return;
      seen.add(id);

      // 获取标题
      let title = link.getAttribute('title') || link.textContent?.trim() || '';
      // 如果标题包含很多内容，尝试提取
      const titleEl = link.querySelector('.title, [class*="title"]');
      if (titleEl) title = titleEl.textContent?.trim() || title;

      // 清理标题
      title = title.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (title.length > 80) title = title.slice(0, 80);

      if (!title || title.length < 1) return;

      // 找到父容器提取评分、年份、海报
      const parent = link.closest('li') || link.closest('.item') || link.closest('[class*="item"]') || link.parentElement;

      let rating = 0;
      let voteCount = 0;
      let releaseYear = '';
      let posterUrl: string | null = null;

      if (parent) {
        // 评分
        const ratingEl = parent.querySelector('.rating_nums, [class*="rating_num"], .rating, .star');
        if (ratingEl) {
          const rMatch = ratingEl.textContent?.match(/([\d.]+)/);
          if (rMatch) rating = parseFloat(rMatch[1]);
        }

        // 评价人数
        const voteEl = parent.querySelector('.pl, [class*="rating_people"], [class*="vote"]');
        if (voteEl) {
          const vMatch = voteEl.textContent?.match(/\d+/);
          // 可能包含括号，提取数字
          const nums = voteEl.textContent?.match(/\((\d+)/) || voteEl.textContent?.match(/(\d+)/);
          // try again
        }

        // 用 parent 的 textContent 提取人数
        const parentText = parent.textContent || '';
        const voteParentMatch = parentText.match(/\((\d+)\s*人/);
        if (voteParentMatch) voteCount = parseInt(voteParentMatch[1]);

        // 年份
        const yearMatch = parentText.match(/(\d{4})/);
        if (yearMatch) releaseYear = yearMatch[1];

        // 海报
        const imgEl = parent.querySelector('img');
        if (imgEl) {
          const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
          if (src && !src.includes('celebrity') && !src.includes('default') && !src.includes('icon')) {
            posterUrl = src;
          }
        }
      }

      // 过滤掉无效条目
      const lowerTitle = title.toLowerCase();
      if (
        lowerTitle.includes('http') ||
        lowerTitle.includes('查看更多') ||
        lowerTitle.includes('更多') ||
        lowerTitle.length > 60
      ) return;

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
    } catch {
      // skip
    }
  });

  // 按人气排序
  films.sort((a, b) => b.popularity - a.popularity);

  return films.slice(0, MAX_FILMS);
}
