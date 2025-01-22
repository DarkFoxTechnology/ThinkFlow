import { createRouter, createWebHistory } from 'vue-router'
import MindMap from '../views/MindMap.vue'
import ErrorDashboard from '../views/ErrorDashboard.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/',
    name: 'MindMap',
    component: MindMap
  },
  {
    path: '/monitor',
    name: 'ErrorDashboard',
    component: ErrorDashboard,
    meta: {
      requiresAuth: true,
      roles: ['admin']
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('../views/Forbidden.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // 检查用户是否已登录
    const isAuthenticated = localStorage.getItem('user')
    if (!isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      })
    } else {
      // 检查用户角色
      const user = JSON.parse(isAuthenticated)
      if (to.meta.roles && !to.meta.roles.includes(user.role)) {
        next({ path: '/403' })
      } else {
        next()
      }
    }
  } else {
    next()
  }
})

export default router