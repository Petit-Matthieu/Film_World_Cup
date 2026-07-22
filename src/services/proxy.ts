import { IS_DEV } from '../constants';

const log = (...args: unknown[]) => {
  console.log('[Proxy]', ...args);
};

// 检测运行平台
function isNetlify(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.includes('netlify.app');
}

export async function fetchDouban(url: string): Promise<string> {
  // 开发模式：Vite 代理（零延迟，100%可靠）
  if (IS_DEV) {
    const proxyUrl = url
      .replace('https://movie.douban.com', '/api/movie')
      .replace('https://www.douban.com', '/api/www');
    log('dev:', url, '→', proxyUrl);
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  // Netlify 平台：使用内置 serverless 代理函数
  if (isNetlify()) {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    log('netlify proxy:', proxyUrl);
    const res = await fetch(proxyUrl);
    if (res.ok) return await res.text();
    throw new Error(`Netlify proxy error: HTTP ${res.status}`);
  }

  // GitHub Pages 等纯静态平台：尝试公共 CORS 代理
  const publicProxies = [
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  const errors: string[] = [];
  for (const buildProxy of publicProxies) {
    try {
      const proxyUrl = buildProxy(url);
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 100) return text;
      }
      errors.push(`HTTP ${res.status}`);
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  log('All proxies failed:', errors);
  throw new Error(
    '公共代理不可用（可能被墙）。请使用本地运行 "npm run dev" 或部署到 Netlify。详见 README。'
  );
}

export async function fetchDoubanJSON(url: string): Promise<any> {
  const text = await fetchDouban(url);
  try {
    return JSON.parse(text);
  } catch {
    log('JSON parse failed, got:', text.slice(0, 100));
    return null;
  }
}
