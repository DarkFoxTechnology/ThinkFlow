<template>
  <div class="forbidden-container">
    <div class="forbidden-content">
      <h1>403</h1>
      <h2>访问被拒绝</h2>
      <p>抱歉，您没有权限访问此页面</p>
      <router-link to="/" class="back-home">
        返回首页
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.forbidden-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f6fa;
}

.forbidden-content {
  text-align: center;
  padding: 2rem;
}

h1 {
  font-size: 6rem;
  color: #ff6b6b;
  margin: 0;
  line-height: 1;
}

h2 {
  font-size: 2rem;
  color: #2c3e50;
  margin: 1rem 0;
}

p {
  color: #666;
  margin-bottom: 2rem;
}

.back-home {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background-color: #4a90e2;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.back-home:hover {
  background-color: #357abd;
}
</style> 