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
        rewrite: (path) => path.replace(/^\/api\/movie/, ''),
        headers: {
          Referer: 'https://movie.douban.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      '/api/www': {
        target: 'https://www.douban.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/www/, ''),
        headers: {
          Referer: 'https://www.douban.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      '/api/img': {
        target: 'https://img1.doubanio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/img/, ''),
        headers: { Referer: 'https://movie.douban.com/' },
      },
      '/api/img2': {
        target: 'https://img2.doubanio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/img2/, ''),
        headers: { Referer: 'https://movie.douban.com/' },
      },
      '/api/img3': {
        target: 'https://img3.doubanio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/img3/, ''),
        headers: { Referer: 'https://movie.douban.com/' },
      },
    },
  },
})
