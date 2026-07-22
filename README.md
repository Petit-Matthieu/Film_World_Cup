# 🏆🎬 电影世界杯 | Film World Cup

搜索导演或演员，用 Ta 的经典电影来一场单败淘汰赛！

## 🚀 本地运行（推荐，零延迟）

```bash
git clone https://github.com/Petit-Matthieu/Film_World_Cup.git
cd Film_World_Cup
npm install --registry=https://registry.npmmirror.com
npm run dev
```

浏览器打开 `http://localhost:5173/Film_World_Cup/`

> 本地运行时通过 Vite 代理直连豆瓣，无 CORS 问题，稳定可靠。

## 🌐 在线部署

### 方案一：Netlify（推荐，自带代理）

1. 注册 [Netlify](https://app.netlify.com)（免费）
2. 点击 "Import from Git" → 选择此仓库
3. 无需任何配置，自动部署完成
4. 访问 Netlify 提供的域名即可使用

> Netlify 内置了 `netlify/functions/proxy.js` 代理函数，在墙内也能正常访问豆瓣。

### 方案二：GitHub Pages（已有）

https://petit-matthieu.github.io/Film_World_Cup/

> ⚠️ 在中国大陆可能因为 CORS 代理被墙而无法加载数据，建议用本地运行或 Netlify。

## ✨ 功能

- 🔍 输入即联想：搜索豆瓣影人
- 🎯 按评分自动选前 32 部电影
- ⚔️ 单败淘汰赛：32→16→8→4→2→🏆
- 📸 生成分享图片（对阵图 + 二维码）
- 💾 自动保存进度

## 🛠️ 技术栈

React 18 · TypeScript · Vite 6 · Tailwind CSS · 豆瓣

## 📄 License

MIT
