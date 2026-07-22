// 豆瓣 URL 模板
export const DOUBAN_SEARCH_URL = 'https://www.douban.com/search';
export const DOUBAN_MOVIE_URL = 'https://movie.douban.com';
export const DOUBAN_CELEBRITY_URL = 'https://movie.douban.com/celebrity';

// CORS 代理列表（按优先级排列）
export const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

// 图片代理（豆瓣图片有防盗链）
export const IMAGE_PROXY = (url: string) =>
  `https://corsproxy.io/?${encodeURIComponent(url)}`;

// 应用常量
export const MAX_FILMS = 32;
export const MIN_FILMS = 16;
export const STORAGE_KEY = 'film-world-cup-state';

// 轮次名称
export const ROUND_NAMES_32 = [
  '32强赛',
  '16强赛',
  '四分之一决赛',
  '半决赛',
  '决赛',
];

export const ROUND_NAMES_16 = [
  '16强赛',
  '四分之一决赛',
  '半决赛',
  '决赛',
];

export const APP_TITLE = '电影世界杯';
export const APP_SUBTITLE = 'Film World Cup';
