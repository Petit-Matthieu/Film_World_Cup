# 🏆🎬 电影世界杯 | Film World Cup

搜索一位导演或演员，用 Ta 的经典电影来一场单败淘汰赛世界杯！

## ✨ 功能

- 🔍 搜索豆瓣影人（导演/演员）
- 🎯 自动按评分排序，选取最受欢迎的 32 部（或 16 部）电影
- ⚔️ 标准单败淘汰赛：32→16→8→4→2→🏆
- 📸 生成分享图片（含完整对阵图 + 二维码）
- 💾 自动保存进度，刷新不丢失
- 📱 响应式设计，手机电脑都能玩

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/YOUR_USERNAME/Film_World_Cup.git
cd Film_World_Cup

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器
# http://localhost:5173/Film_World_Cup/
```

## 🛠️ 构建

```bash
npm run build
# 输出在 dist/ 目录
```

## 📦 技术栈

- React 18 + TypeScript
- Vite 6
- Tailwind CSS 3
- react-router-dom 6
- 豆瓣网数据（通过 CORS 代理抓取）
- html-to-image（图片导出）
- qrcode.react（二维码）

## 🌐 数据来源

电影数据来自豆瓣网（douban.com），通过 CORS 代理抓取解析，**无需任何 API Key**。

## 📄 License

MIT
