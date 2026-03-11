import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use base path so SW scope matches GitHub Pages deployment path
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      .then(reg => console.log('[SW] registered, scope:', reg.scope))
      .catch(err => console.warn('[SW] registration failed:', err))
  })
}
