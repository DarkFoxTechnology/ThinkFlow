// 环境变量配置
export const config = {
  // WebSocket 配置
  ws: {
    url: import.meta.env.VITE_WS_URL,
    reconnectAttempts: parseInt(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS, 10),
    reconnectDelay: parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY, 10)
  },

  // API 配置
  api: {
    url: import.meta.env.VITE_API_URL,
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT, 10)
  },

  // 功能配置
  features: {
    autoSaveInterval: parseInt(import.meta.env.VITE_AUTO_SAVE_INTERVAL, 10),
    maxUndoSteps: parseInt(import.meta.env.VITE_MAX_UNDO_STEPS, 10)
  },

  // 调试配置
  debug: {
    enabled: import.meta.env.VITE_DEBUG === 'true',
    logLevel: import.meta.env.VITE_LOG_LEVEL
  }
}

// 默认配置
const defaultConfig = {
  ws: {
    url: 'ws://localhost:5173',
    reconnectAttempts: 3,
    reconnectDelay: 1000
  },
  api: {
    url: 'http://localhost:3000',
    timeout: 5000
  },
  features: {
    autoSaveInterval: 5000,
    maxUndoSteps: 50
  },
  debug: {
    enabled: false,
    logLevel: 'info'
  }
}

// 合并配置
function mergeConfig(config, defaultConfig) {
  const merged = { ...defaultConfig }
  
  for (const key in config) {
    if (typeof config[key] === 'object' && config[key] !== null) {
      merged[key] = mergeConfig(config[key], defaultConfig[key])
    } else if (config[key] !== undefined && config[key] !== '') {
      merged[key] = config[key]
    }
  }
  
  return merged
}

// 导出最终配置
export const finalConfig = mergeConfig(config, defaultConfig)

// 配置验证
function validateConfig(config) {
  const errors = []

  // WebSocket 配置验证
  if (!config.ws.url) {
    errors.push('WebSocket URL is required')
  }
  if (config.ws.reconnectAttempts < 1) {
    errors.push('Reconnect attempts must be at least 1')
  }
  if (config.ws.reconnectDelay < 100) {
    errors.push('Reconnect delay must be at least 100ms')
  }

  // API 配置验证
  if (!config.api.url) {
    errors.push('API URL is required')
  }
  if (config.api.timeout < 1000) {
    errors.push('API timeout must be at least 1000ms')
  }

  // 功能配置验证
  if (config.features.autoSaveInterval < 1000) {
    errors.push('Auto save interval must be at least 1000ms')
  }
  if (config.features.maxUndoSteps < 1) {
    errors.push('Max undo steps must be at least 1')
  }

  return errors
}

// 验证配置并在开发模式下输出警告
const configErrors = validateConfig(finalConfig)
if (configErrors.length > 0) {
  console.warn('Configuration warnings:', configErrors)
}

// 导出配置获取函数
export function getConfig(path) {
  return path.split('.').reduce((obj, key) => obj && obj[key], finalConfig)
}

// 导出环境判断函数
export const isDevelopment = import.meta.env.DEV
export const isProduction = import.meta.env.PROD
export const mode = import.meta.env.MODE 