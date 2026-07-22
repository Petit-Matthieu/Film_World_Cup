// Netlify Serverless Function - CORS Proxy for Douban
// 部署到 Netlify 后自动生效，免费 125k 请求/月

export default async (req) => {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return new Response('Missing ?url= parameter', { status: 400 });
  }

  // 只允许代理豆瓣域名
  const allowed = ['douban.com', 'doubanio.com'];
  const targetHost = new URL(url).hostname;
  if (!allowed.some((d) => targetHost.endsWith(d))) {
    return new Response('Only douban.com domains allowed', { status: 403 });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://movie.douban.com/',
      },
    });
    const body = await resp.text();

    return new Response(body, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('content-type') || 'text/html',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 502 });
  }
};
