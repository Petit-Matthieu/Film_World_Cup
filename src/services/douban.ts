import { fetchWithProxy, proxyImage } from './proxy';
import type { Person, Movie } from '../types';
import { DOUBAN_SEARCH_URL, DOUBAN_MOVIE_URL, MAX_FILMS } from '../constants';

/**
 * 搜索影人（导演/演员）
 */
export async function searchPerson(query: string): Promise<Person[]> {
  const url = `${DOUBAN_SEARCH_URL}?q=${encodeURIComponent(query)}&cat=1002`;
  const html = await fetchWithProxy(url);

  // 用 DOMParser 解析搜索结果
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const results: Person[] = [];
  const items = doc.querySelectorAll('.search-result .result');

  items.forEach((item, index) => {
    try {
      // 提取影人链接和 ID
      const linkEl = item.querySelector('.title a, h3 a, a[href*="/celebrity/"]');
      if (!linkEl) return;

      const href = linkEl.getAttribute('href') || '';
      const idMatch = href.match(/celebrity\/(\d+)/);
      if (!idMatch) return;

      const id = idMatch[1];
      const name = linkEl.textContent?.trim() || '';

      // 提取描述（判断是导演还是演员）
      const descEl = item.querySelector('.subject-cast, .meta, p');
      const description = descEl?.textContent?.trim() || '';

      let department = '影人';
      // 豆瓣搜索结果的 cat=1002 已经是影人

      // 提取头像
      const imgEl = item.querySelector('img');
      const avatarUrl = imgEl?.getAttribute('src') || null;

      if (name && id) {
        results.push({
          id,
          name,
          department,
          avatarUrl: avatarUrl ? proxyImage(avatarUrl) : null,
        });
      }
    } catch (e) {
      // 跳过解析失败的条目
    }
  });

  // 如果上面方法没解析到，尝试另一种解析方式（豆瓣的搜索结果结构多变）
  if (results.length === 0) {
    const altItems = doc.querySelectorAll('.result-item, .sc-bZQynM, [class*="result"]');
    altItems.forEach((item) => {
      try {
        const linkEl = item.querySelector('a[href*="celebrity"]') || item.querySelector('a[href*="movie.douban.com"]');
        if (!linkEl) return;
        const href = linkEl.getAttribute('href') || '';
        const idMatch = href.match(/celebrity\/(\d+)|subject\/(\d+)/);
        if (!idMatch) return;
        const id = idMatch[1] || idMatch[2];
        const name = linkEl.textContent?.trim() || '';
        const imgEl = item.querySelector('img');
        const avatarUrl = imgEl?.getAttribute('src') || null;

        if (name && id) {
          results.push({
            id,
            name,
            department: '影人',
            avatarUrl: avatarUrl ? proxyImage(avatarUrl) : null,
          });
        }
      } catch (e) {
        // skip
      }
    });
  }

  return results.slice(0, 20);
}

/**
 * 获取影人的电影作品列表（按评分排序）
 */
export async function getPersonFilms(personId: string): Promise<Movie[]> {
  // 使用移动端页面，format=pic 且 sortby=vote 按评价排序
  const url = `${DOUBAN_MOVIE_URL}/celebrity/${personId}/movies?start=0&format=pic&sortby=vote`;
  const html = await fetchWithProxy(url);

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const films: Movie[] = [];
  const seen = new Set<string>();

  // 解析作品列表
  const items = doc.querySelectorAll('.grid-view .item, .item, [class*="movie"]');

  // 如果上面选择器没匹配到，尝试更通用的方法
  const processDoc = (document: Document) => {
    // 方法1: 查找所有电影链接
    const movieLinks = document.querySelectorAll('a[href*="/subject/"]');
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

        // 尝试找到对应的标题
        let title = '';
        const titleEl = link.querySelector('.title, [class*="title"]') || link;
        title = titleEl.textContent?.trim() || link.getAttribute('title') || '';

        // 如果标题太长（可能是URL或其他），截取合理长度
        if (title.length > 100) {
          title = title.split(/\s+/)[0] || title.slice(0, 50);
        }

        // 找到对应的评分
        const parentItem = link.closest('.item, [class*="item"], li, tr, div');
        let rating = 0;
        let voteCount = 0;
        let releaseYear = '';
        let posterUrl: string | null = null;

        if (parentItem) {
          // 评分
          const ratingEl = parentItem.querySelector('.rating_nums, [class*="rating"], .star');
          if (ratingEl) {
            const ratingText = ratingEl.textContent?.trim() || '';
            const ratingMatch = ratingText.match(/([\d.]+)/);
            if (ratingMatch) rating = parseFloat(ratingMatch[1]);
          }

          // 评价人数
          const voteEl = parentItem.querySelector('.pl, [class*="vote"], [class*="rating_people"]');
          if (voteEl) {
            const voteText = voteEl.textContent?.trim() || '';
            const voteMatch = voteText.match(/(\d+)/);
            if (voteMatch) voteCount = parseInt(voteMatch[1]);
          }

          // 年份
          const yearEl = parentItem.querySelector('[class*="year"], .date, .intro');
          if (yearEl) {
            const yearText = yearEl.textContent?.trim() || '';
            const yearMatch = yearText.match(/(\d{4})/);
            if (yearMatch) releaseYear = yearMatch[1];
          }

          // 海报
          const imgEl = parentItem.querySelector('img');
          if (imgEl) {
            const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
            if (src && !src.includes('celebrity') && !src.includes('default')) {
              posterUrl = src;
            }
          }
        }

        // 仍然没有标题的话，清理链接文本
        if (!title || title.length < 1) {
          title = '未知电影';
        }

        // 清理标题
        title = title.replace(/^[\d.\s]+/, '').replace(/\s+/g, ' ').trim();
        if (title.length > 50) title = title.slice(0, 50) + '...';

        if (title && id && title !== '未知电影') {
          const popularity = rating * Math.log10(Math.max(voteCount, 10));
          films.push({
            id,
            title,
            posterUrl: posterUrl ? proxyImage(posterUrl) : null,
            rating,
            voteCount,
            releaseYear,
            popularity: Math.round(popularity * 100) / 100,
          });
        }
      } catch (e) {
        // skip
      }
    });
  };

  processDoc(doc);

  // 按 popularity 降序排序
  films.sort((a, b) => b.popularity - a.popularity);

  // 过滤掉明显不是电影的条目（标题过短、无评分等）
  const valid = films.filter(
    (f) => f.title.length >= 1 && !f.title.includes('http') && f.title.length <= 60
  );

  return valid.slice(0, MAX_FILMS);
}

/**
 * 获取电影详情（备选）
 */
export async function getFilmDetails(filmId: string): Promise<Movie | null> {
  try {
    const url = `${DOUBAN_MOVIE_URL}/subject/${filmId}/`;
    const html = await fetchWithProxy(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const titleEl = doc.querySelector('h1 span[property="v:itemreviewed"]') || doc.querySelector('h1');
    const title = titleEl?.textContent?.trim() || '';

    const ratingEl = doc.querySelector('strong.rating_num');
    const rating = parseFloat(ratingEl?.textContent?.trim() || '0');

    const voteEl = doc.querySelector('span[property="v:votes"]');
    const voteCount = parseInt(voteEl?.textContent?.trim() || '0');

    const yearEl = doc.querySelector('span.year');
    const yearMatch = yearEl?.textContent?.match(/(\d{4})/);
    const releaseYear = yearMatch ? yearMatch[1] : '';

    const imgEl = doc.querySelector('#mainpic img') as HTMLImageElement | null;
    const posterUrl = imgEl?.getAttribute('src') || null;

    if (!title) return null;

    return {
      id: filmId,
      title,
      posterUrl: posterUrl ? proxyImage(posterUrl) : null,
      rating,
      voteCount,
      releaseYear,
      popularity: Math.round(rating * Math.log10(Math.max(voteCount, 10)) * 100) / 100,
    };
  } catch {
    return null;
  }
}
