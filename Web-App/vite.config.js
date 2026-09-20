import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/fonnte': {
        target: 'https://api.fonnte.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fonnte/, '')
      },
      '/api/push': {
        target: 'https://exp.host',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/push/, '/--/api/v2/push')
      }
    }
  }
})
