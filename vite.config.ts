import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: "/taskflow/",
  build: {
    outDir: 'dist',
    rollupOptions: { output: { manualChunks: { vue: ['vue', 'pinia'] } } },
  },
})
