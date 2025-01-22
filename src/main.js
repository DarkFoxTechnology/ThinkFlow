import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { errorReporter } from './utils/errorReporter'

// 初始化错误监控
errorReporter.initMonitoring()

// 创建应用实例
const app = createApp(App)

// 全局错误处理
app.config.errorHandler = (error, instance, info) => {
  errorReporter.report(error, 'error', {
    componentName: instance?.$.type?.name,
    errorInfo: info
  })
}

// 注册 Pinia
app.use(createPinia())

// 注册路由
app.use(router)

// 挂载应用
app.mount('#app')

// 记录应用启动
errorReporter.addBreadcrumb('lifecycle', 'Application started', {
  timestamp: new Date().toISOString()
})
