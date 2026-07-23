// Cloudflare Worker — 豆瓣图片代理
// 部署: npx wrangler deploy
// 然后将返回的 URL 填入 src/services/douban.ts 的 IMG_PROXY 常量

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const img = url.searchParams.get('url');
    if (!img) return new Response('Missing url param', { status: 400 });

    const response = await fetch(img, {
      headers: {
        'Referer': 'https://movie.douban.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=604800, s-maxage=604800');
    headers.set('Vary', 'Accept-Encoding');

    return new Response(response.body, { status: response.status, headers });
  },
};
