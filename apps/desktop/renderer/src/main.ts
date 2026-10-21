import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { dir, locale } from './lib/i18n'
import { router } from './router'
import './styles/main.css'

document.documentElement.lang = locale
document.documentElement.dir = dir

createApp(App).use(createPinia()).use(router).mount('#app')
