// 开发模式使用 Vite 代理，生产模式使用 CORS 代理
export const IS_DEV = import.meta.env.DEV;

// API 基础路径
export const API_MOVIE = IS_DEV ? '/api/movie' : 'https://movie.douban.com';
export const API_WWW = IS_DEV ? '/api/www' : 'https://www.douban.com';

// CORS 代理列表（仅生产模式使用）
export const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// 图片 URL 转换（开发模式走代理，生产模式用 weserv）
export function getImageUrl(url: string | null): string | null {
  if (!url) return null;
  // 豆瓣图片通常在 img1/img2/img3.doubanio.com
  if (IS_DEV) {
    // 将图片域名替换为本地代理
    return url
      .replace('https://img1.doubanio.com', '/api/img')
      .replace('https://img2.doubanio.com', '/api/img2')
      .replace('https://img3.doubanio.com', '/api/img3')
      .replace('https://img9.doubanio.com', '/api/img');
  }
  // 生产模式用 weserv 代理
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=300&output=webp`;
}

// 豆瓣 URL 模板
export const DOUBAN_SEARCH_URL = 'https://www.douban.com/search';
export const DOUBAN_MOVIE_URL = 'https://movie.douban.com';
export const DOUBAN_CELEBRITY_URL = 'https://movie.douban.com/celebrity';

// 应用常量
export const MAX_FILMS = 32;
export const MIN_FILMS = 16;
export const STORAGE_KEY = 'film-world-cup-state';

// 轮次名称
export const ROUND_NAMES_32 = ['32强赛', '16强赛', '四分之一决赛', '半决赛', '决赛'];
export const ROUND_NAMES_16 = ['16强赛', '四分之一决赛', '半决赛', '决赛'];

export const APP_TITLE = '电影世界杯';
export const APP_SUBTITLE = 'Film World Cup';
