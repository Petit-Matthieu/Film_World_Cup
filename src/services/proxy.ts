import { IS_DEV, CORS_PROXIES } from '../constants';

/**
 * 请求豆瓣页面/API
 * 开发模式：通过 Vite proxy 直连（无 CORS 问题）
 * 生产模式：通过 CORS 代理
 */
export async function fetchDouban(url: string): Promise<string> {
  if (IS_DEV) {
    // 开发模式：转换 URL 为本地代理路径
    let proxyUrl = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  // 生产模式：尝试多个 CORS 代理
  return fetchWithCORSProxy(url, 0);
}

async function fetchWithCORSProxy(
  url: string,
  proxyIndex: number
): Promise<string> {
  if (proxyIndex >= CORS_PROXIES.length) {
    throw new Error('所有代理均不可用，请稍后重试');
  }

  try {
    const proxyUrl = CORS_PROXIES[proxyIndex](url);
    const res = await fetch(proxyUrl);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return JSON.stringify(await res.json());
    }
    return await res.text();
  } catch (err) {
    console.warn(`代理 ${proxyIndex + 1} 失败，尝试下一个...`);
    return fetchWithCORSProxy(url, proxyIndex + 1);
  }
}

/**
 * 请求豆瓣 JSON API
 */
export async function fetchDoubanJSON(url: string): Promise<any> {
  if (IS_DEV) {
    let proxyUrl = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const proxyUrl = CORS_PROXIES[i](url);
      const res = await fetch(proxyUrl);
      if (!res.ok) continue;
      return await res.json();
    } catch {
      continue;
    }
  }

  throw new Error('所有代理均不可用');
}
