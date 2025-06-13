import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import VueApexCharts from 'vue3-apexcharts'

const vueQueryOptions= {
    queryClientConfig: {
        defaultOptions: {
        }
    }
}

const app = createApp(App)

app.use(VueQueryPlugin, vueQueryOptions)
app.use(VueApexCharts)

app.mount('#app')
