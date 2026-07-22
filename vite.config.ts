import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Film_World_Cup/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/movie': {
        target: 'https://movie.douban.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/movie/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Referer', 'https://movie.douban.com/');
            proxyReq.setHeader('User-Agent',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Accept-Language', 'zh-CN,zh;q=0.9');
          });
        },
      },
      '/api/www': {
        target: 'https://www.douban.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/www/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Referer', 'https://www.douban.com/');
            proxyReq.setHeader('User-Agent',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Accept', 'application/json, text/html, */*');
            proxyReq.setHeader('Accept-Language', 'zh-CN,zh;q=0.9');
          });
        },
      },
      '/api/img': {
        target: 'https://img1.doubanio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/img/, ''),
      },
      '/api/img2': {
        target: 'https://img2.doubanio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/img2/, ''),
      },
      '/api/img3': {
        target: 'https://img3.doubanio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/img3/, ''),
      },
      '/api/img9': {
        target: 'https://img9.doubanio.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/img9/, ''),
      },
    },
  },
})
