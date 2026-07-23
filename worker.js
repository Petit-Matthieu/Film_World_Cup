// Cloudflare Worker — 豆瓣全功能代理
// 部署: npx wrangler deploy
// 获得 URL 后填入 src/services/douban.ts 的 DOUBAN_PROXY 常量

export default {
  async fetch(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) return new Response('Missing url param. Usage: /?url=https://...', { status: 400 });

    try {
      const response = await fetch(target, {
        headers: {
          'Referer': 'https://movie.douban.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
      });

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (e) {
      return new Response('Proxy error: ' + e.message, { status: 502 });
    }
  },
};
