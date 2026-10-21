import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { setLocale } from './lib/i18n'
import { router } from './router'
import './styles/main.css'

setLocale('en')

createApp(App).use(createPinia()).use(router).mount('#app')
