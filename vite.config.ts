import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  plugins: [vue()],
  base,
  build: {
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { vue: ['vue', 'pinia'] } } },
  },
})
