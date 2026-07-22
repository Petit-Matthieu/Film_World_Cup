import { CORS_PROXIES } from '../constants';

/**
 * 通过 CORS 代理发起请求，自动尝试备用代理
 */
export async function fetchWithProxy(
  url: string,
  proxyIndex: number = 0
): Promise<string> {
  if (proxyIndex >= CORS_PROXIES.length) {
    throw new Error('所有代理均不可用，请稍后重试');
  }

  const proxyUrl = CORS_PROXIES[proxyIndex](url);

  try {
    const res = await fetch(proxyUrl, {
      headers: {
        'Accept': 'text/html,application/json,*/*',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return JSON.stringify(await res.json());
    }
    return await res.text();
  } catch (err) {
    console.warn(`代理 ${proxyIndex + 1} 失败，尝试下一个...`, err);
    return fetchWithProxy(url, proxyIndex + 1);
  }
}

/**
 * 代理图片 URL（绕过豆瓣防盗链）
 */
export function proxyImage(url: string): string {
  if (!url) return '';
  // 使用 images.weserv.nl 代理图片，支持裁剪和 HTTPS
  const encoded = encodeURIComponent(url);
  return `https://images.weserv.nl/?url=${encoded}&w=300&output=webp`;
}
