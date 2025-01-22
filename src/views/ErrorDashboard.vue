<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>错误监控面板</h1>
      <div class="time-range-selector">
        <select v-model="selectedTimeRange">
          <option value="3600000">最近1小时</option>
          <option value="86400000">最近24小时</option>
          <option value="604800000">最近7天</option>
          <option value="2592000000">最近30天</option>
        </select>
      </div>
    </header>

    <div class="dashboard-content">
      <!-- 错误概览 -->
      <section class="overview-section">
        <div class="stat-card">
          <h3>总错误数</h3>
          <div class="stat-value">{{ totalErrors }}</div>
          <div class="stat-trend" :class="errorTrend.type">
            {{ errorTrend.value }}%
            <i :class="errorTrend.type === 'up' ? 'trend-up' : 'trend-down'"></i>
          </div>
        </div>

        <div class="stat-card">
          <h3>影响用户数</h3>
          <div class="stat-value">{{ affectedUsers }}</div>
        </div>

        <div class="stat-card">
          <h3>平均响应时间</h3>
          <div class="stat-value">{{ avgResponseTime }}ms</div>
        </div>

        <div class="stat-card">
          <h3>内存使用率</h3>
          <div class="stat-value">{{ memoryUsage }}%</div>
          <div class="progress-bar">
            <div :style="{ width: memoryUsage + '%' }" :class="{ warning: memoryUsage > 80 }"></div>
          </div>
        </div>
      </section>

      <!-- 错误趋势图 -->
      <section class="chart-section">
        <div class="chart-container">
          <h3>错误趋势</h3>
          <canvas ref="errorTrendChart"></canvas>
        </div>
      </section>

      <!-- 错误列表 -->
      <section class="error-list-section">
        <h3>错误列表</h3>
        <div class="filters">
          <input 
            v-model="searchQuery" 
            placeholder="搜索错误..." 
            @input="filterErrors"
          >
          <select v-model="severityFilter">
            <option value="">所有严重程度</option>
            <option value="error">错误</option>
            <option value="warning">警告</option>
            <option value="info">信息</option>
          </select>
        </div>

        <div class="error-list">
          <div 
            v-for="error in filteredErrors" 
            :key="error._id"
            class="error-item"
            :class="error.severity"
            @click="showErrorDetail(error)"
          >
            <div class="error-header">
              <span class="error-name">{{ error.name }}</span>
              <span class="error-count">出现 {{ error.count }} 次</span>
            </div>
            <div class="error-message">{{ error.message }}</div>
            <div class="error-meta">
              <span>首次出现: {{ formatDate(error.firstSeen) }}</span>
              <span>最后出现: {{ formatDate(error.lastSeen) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 性能指标 -->
      <section class="performance-section">
        <h3>性能指标</h3>
        <div class="performance-metrics">
          <div class="metric-card">
            <h4>页面加载时间</h4>
            <div class="metric-value">{{ pageLoadTime }}ms</div>
            <div class="metric-chart">
              <canvas ref="loadTimeChart"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <h4>API 响应时间</h4>
            <div class="metric-value">{{ apiResponseTime }}ms</div>
            <div class="metric-chart">
              <canvas ref="apiResponseChart"></canvas>
            </div>
          </div>

          <div class="metric-card">
            <h4>资源加载时间</h4>
            <div class="metric-value">{{ resourceLoadTime }}ms</div>
            <div class="metric-chart">
              <canvas ref="resourceLoadChart"></canvas>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 错误详情弹窗 -->
    <div v-if="selectedError" class="error-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>错误详情</h2>
          <button @click="selectedError = null">关闭</button>
        </div>
        <div class="modal-body">
          <div class="error-detail">
            <h3>基本信息</h3>
            <div class="detail-item">
              <span class="label">错误名称:</span>
              <span class="value">{{ selectedError.name }}</span>
            </div>
            <div class="detail-item">
              <span class="label">错误消息:</span>
              <span class="value">{{ selectedError.message }}</span>
            </div>
            <div class="detail-item">
              <span class="label">错误类型:</span>
              <span class="value">{{ selectedError.type }}</span>
            </div>
            <div class="detail-item">
              <span class="label">严重程度:</span>
              <span class="value">{{ selectedError.severity }}</span>
            </div>
          </div>

          <div class="stack-trace">
            <h3>堆栈跟踪</h3>
            <pre>{{ selectedError.stack }}</pre>
          </div>

          <div class="breadcrumbs">
            <h3>操作记录</h3>
            <div class="breadcrumb-list">
              <div 
                v-for="(crumb, index) in selectedError.breadcrumbs" 
                :key="index"
                class="breadcrumb-item"
              >
                <div class="breadcrumb-time">
                  {{ formatTime(crumb.timestamp) }}
                </div>
                <div class="breadcrumb-content">
                  <div class="breadcrumb-category">{{ crumb.category }}</div>
                  <div class="breadcrumb-message">{{ crumb.message }}</div>
                  <pre v-if="crumb.data" class="breadcrumb-data">
                    {{ JSON.stringify(crumb.data, null, 2) }}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Chart from 'chart.js/auto'
import { getConfig } from '../utils/config'

// 状态
const selectedTimeRange = ref(86400000) // 默认24小时
const searchQuery = ref('')
const severityFilter = ref('')
const selectedError = ref(null)
const errors = ref([])
const totalErrors = ref(0)
const affectedUsers = ref(0)
const avgResponseTime = ref(0)
const memoryUsage = ref(0)
const pageLoadTime = ref(0)
const apiResponseTime = ref(0)
const resourceLoadTime = ref(0)

// Chart refs
const errorTrendChart = ref(null)
const loadTimeChart = ref(null)
const apiResponseChart = ref(null)
const resourceLoadChart = ref(null)

// 计算属性
const errorTrend = computed(() => {
  // 计算错误趋势
  const previousErrors = 100 // 上一个时间段的错误数
  const currentErrors = totalErrors.value
  const trend = ((currentErrors - previousErrors) / previousErrors) * 100
  
  return {
    value: Math.abs(trend).toFixed(1),
    type: trend > 0 ? 'up' : 'down'
  }
})

const filteredErrors = computed(() => {
  return errors.value.filter(error => {
    const matchesSearch = !searchQuery.value || 
      error.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      error.message.toLowerCase().includes(searchQuery.value.toLowerCase())
    
    const matchesSeverity = !severityFilter.value || 
      error.severity === severityFilter.value
    
    return matchesSearch && matchesSeverity
  })
})

// 方法
async function fetchErrorStats() {
  try {
    const response = await fetch(`${getConfig('api.url')}/errors/stats?timeRange=${selectedTimeRange.value}`)
    const data = await response.json()
    errors.value = data
    totalErrors.value = data.reduce((sum, error) => sum + error.count, 0)
  } catch (error) {
    console.error('Failed to fetch error stats:', error)
  }
}

async function fetchPerformanceData() {
  try {
    const response = await fetch(`${getConfig('api.url')}/performance?timeRange=${selectedTimeRange.value}`)
    const data = await response.json()
    
    // 更新性能指标
    const pageLoads = data.find(d => d._id === 'Page Load')
    if (pageLoads) {
      pageLoadTime.value = pageLoads.avgDuration.toFixed(0)
    }

    const apiCalls = data.find(d => d._id === 'API Call')
    if (apiCalls) {
      apiResponseTime.value = apiCalls.avgDuration.toFixed(0)
    }

    const resourceLoads = data.find(d => d._id === 'Resource Load')
    if (resourceLoads) {
      resourceLoadTime.value = resourceLoads.avgDuration.toFixed(0)
    }
  } catch (error) {
    console.error('Failed to fetch performance data:', error)
  }
}

function showErrorDetail(error) {
  selectedError.value = error
}

function formatDate(date) {
  return new Date(date).toLocaleString()
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

// 图表初始化
function initCharts() {
  // 错误趋势图
  new Chart(errorTrendChart.value, {
    type: 'line',
    data: {
      labels: [], // 时间标签
      datasets: [{
        label: '错误数量',
        data: [], // 错误数据
        borderColor: '#ff6b6b',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  })

  // 性能指标图表
  const chartConfig = {
    type: 'line',
    data: {
      labels: [], // 时间标签
      datasets: [{
        data: [], // 性能数据
        borderColor: '#4ecdc4',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      }
    }
  }

  new Chart(loadTimeChart.value, { ...chartConfig })
  new Chart(apiResponseChart.value, { ...chartConfig })
  new Chart(resourceLoadChart.value, { ...chartConfig })
}

// 生命周期钩子
onMounted(() => {
  fetchErrorStats()
  fetchPerformanceData()
  initCharts()

  // 设置定时刷新
  const refreshInterval = setInterval(() => {
    fetchErrorStats()
    fetchPerformanceData()
  }, 60000) // 每分钟刷新一次

  // 组件卸载时清理
  onUnmounted(() => {
    clearInterval(refreshInterval)
  })
})

// 监听时间范围变化
watch(selectedTimeRange, () => {
  fetchErrorStats()
  fetchPerformanceData()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.time-range-selector select {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.dashboard-content {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.overview-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
}

.stat-trend {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.stat-trend.up { color: #ff6b6b; }
.stat-trend.down { color: #4ecdc4; }

.progress-bar {
  height: 4px;
  background: #eee;
  border-radius: 2px;
  margin-top: 10px;
}

.progress-bar > div {
  height: 100%;
  background: #4ecdc4;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-bar > div.warning {
  background: #ff6b6b;
}

.chart-section {
  grid-column: 1 / -1;
}

.chart-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  height: 300px;
}

.error-list-section {
  grid-column: 1 / -1;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.filters input,
.filters select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.error-list {
  display: grid;
  gap: 10px;
}

.error-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  cursor: pointer;
}

.error-item:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

.error-item.error { border-left: 4px solid #ff6b6b; }
.error-item.warning { border-left: 4px solid #ffd93d; }
.error-item.info { border-left: 4px solid #6c5ce7; }

.error-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.error-name {
  font-weight: bold;
}

.error-count {
  color: #666;
}

.error-message {
  color: #444;
  margin-bottom: 10px;
}

.error-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #666;
}

.performance-section {
  grid-column: 1 / -1;
}

.performance-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.metric-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metric-value {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
}

.metric-chart {
  height: 100px;
}

.error-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 20px;
}

.error-detail {
  margin-bottom: 20px;
}

.detail-item {
  margin: 10px 0;
}

.detail-item .label {
  font-weight: bold;
  margin-right: 10px;
}

.stack-trace {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.stack-trace pre {
  margin: 0;
  white-space: pre-wrap;
}

.breadcrumb-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breadcrumb-item {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.breadcrumb-time {
  color: #666;
  font-size: 12px;
}

.breadcrumb-category {
  font-weight: bold;
  margin-bottom: 5px;
}

.breadcrumb-data {
  margin: 5px 0 0;
  font-size: 12px;
  background: #fff;
  padding: 5px;
  border-radius: 2px;
}
</style> 