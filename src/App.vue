<template>
  <div class="app">
    <nav class="nav-menu" :class="{ collapsed: isMenuCollapsed }">
      <div class="nav-header">
        <img src="./assets/logo.png" alt="Logo" class="logo">
        <button class="collapse-btn" @click="toggleMenu" title="切换菜单">
          <i :class="isMenuCollapsed ? 'expand-icon' : 'collapse-icon'"></i>
        </button>
      </div>
      
      <div class="nav-links">
        <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
          <i class="mindmap-icon"></i>
          <span v-if="!isMenuCollapsed">思维导图</span>
        </router-link>
        
        <router-link 
          v-if="isAdmin"
          to="/monitor" 
          class="nav-link" 
          :class="{ active: $route.path === '/monitor' }"
        >
          <i class="monitor-icon"></i>
          <span v-if="!isMenuCollapsed">错误监控</span>
        </router-link>
      </div>

      <div class="nav-footer">
        <div class="user-info" v-if="user">
          <img :src="user.avatar" alt="User avatar" class="user-avatar">
          <div class="user-details" v-if="!isMenuCollapsed">
            <span class="user-name">{{ user.name }}</span>
            <span class="user-role">{{ user.role }}</span>
          </div>
        </div>
        
        <button class="logout-btn" @click="logout" title="退出登录">
          <i class="logout-icon"></i>
          <span v-if="!isMenuCollapsed">退出登录</span>
        </button>
      </div>
    </nav>

    <main class="main-content" :class="{ 'menu-collapsed': isMenuCollapsed }">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isMenuCollapsed = ref(false)
const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

const isAdmin = computed(() => {
  return user.value?.role === 'admin'
})

function toggleMenu() {
  isMenuCollapsed.value = !isMenuCollapsed.value
}

function logout() {
  localStorage.removeItem('user')
  router.push('/login')
}
</script>

<style>
:root {
  --primary-color: #4a90e2;
  --secondary-color: #f5f6fa;
  --text-color: #2c3e50;
  --border-color: #e1e4e8;
  --menu-width: 240px;
  --menu-collapsed-width: 64px;
  --header-height: 60px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-user-select: none;
  user-select: none;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: var(--text-color);
  line-height: 1.6;
}

.app {
  display: flex;
  min-height: 100vh;
}

.nav-menu {
  width: var(--menu-width);
  background: white;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
}

.nav-menu.collapsed {
  width: var(--menu-collapsed-width);
}

.nav-header {
  height: var(--header-height);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  height: 32px;
  width: auto;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color);
}

.collapse-icon::before {
  content: '◀';
}

.expand-icon::before {
  content: '▶';
}

.nav-links {
  flex: 1;
  padding: 20px 0;
}

.nav-link {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  color: var(--text-color);
  text-decoration: none;
  transition: background-color 0.2s ease;
}

.nav-link:hover {
  background-color: var(--secondary-color);
}

.nav-link.active {
  background-color: var(--secondary-color);
  color: var(--primary-color);
  font-weight: 500;
}

.nav-link i {
  width: 24px;
  height: 24px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mindmap-icon::before {
  content: '🗺️';
}

.monitor-icon::before {
  content: '📊';
}

.nav-footer {
  padding: 20px;
  border-top: 1px solid var(--border-color);
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 12px;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-weight: 500;
}

.user-role {
  font-size: 12px;
  color: #666;
}

.logout-btn {
  width: 100%;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.logout-btn:hover {
  background-color: var(--secondary-color);
}

.logout-icon::before {
  content: '🚪';
  margin-right: 8px;
}

.main-content {
  flex: 1;
  margin-left: var(--menu-width);
  transition: margin-left 0.3s ease;
}

.main-content.menu-collapsed {
  margin-left: var(--menu-collapsed-width);
}

@media (max-width: 768px) {
  .nav-menu {
    position: fixed;
    height: 100vh;
    z-index: 1000;
    transform: translateX(0);
    transition: transform 0.3s ease;
  }

  .nav-menu.collapsed {
    transform: translateX(-100%);
  }

  .main-content {
    margin-left: 0;
  }

  .main-content.menu-collapsed {
    margin-left: 0;
  }
}

.toolbar {
  padding: 10px;
  background: rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  justify-content: space-between;
}
</style>
