const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const { createClient } = require('redis')
const winston = require('winston')

// 创建 Express 应用
const app = express()

// 中间件配置
app.use(express.json({ limit: '5mb' }))
app.use(cors())

// 配置 MongoDB 连接
mongoose.connect('mongodb://localhost:27017/mindmap-errors', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// 错误数据模型
const ErrorSchema = new mongoose.Schema({
  name: String,
  message: String,
  stack: String,
  type: String,
  severity: String,
  timestamp: Date,
  context: {
    url: String,
    userAgent: String,
    screenResolution: {
      width: Number,
      height: Number
    },
    viewport: {
      width: Number,
      height: Number
    },
    memory: {
      jsHeapSizeLimit: Number,
      totalJSHeapSize: Number,
      usedJSHeapSize: Number
    }
  },
  breadcrumbs: [{
    timestamp: Date,
    category: String,
    message: String,
    data: mongoose.Schema.Types.Mixed
  }],
  extra: mongoose.Schema.Types.Mixed
})

const Error = mongoose.model('Error', ErrorSchema)

// Redis 客户端配置
const redis = createClient({
  url: 'redis://localhost:6379'
})

redis.on('error', err => console.error('Redis Client Error', err))

// 配置 Winston 日志
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}

// 错误聚合函数
async function aggregateErrors(timeRange) {
  const startTime = new Date(Date.now() - timeRange)
  
  return await Error.aggregate([
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: {
          name: '$name',
          type: '$type',
          message: '$message'
        },
        count: { $sum: 1 },
        firstSeen: { $min: '$timestamp' },
        lastSeen: { $max: '$timestamp' },
        severities: { $addToSet: '$severity' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ])
}

// API 路由
// 接收错误报告
app.post('/errors', async (req, res) => {
  try {
    const errorData = {
      ...req.body,
      timestamp: new Date()
    }

    // 保存到 MongoDB
    const error = new Error(errorData)
    await error.save()

    // 记录到 Winston 日志
    logger.error('New error reported', { error: errorData })

    // 更新 Redis 错误计数
    const key = `errors:${errorData.name}:${new Date().toISOString().split('T')[0]}`
    await redis.incr(key)
    await redis.expire(key, 60 * 60 * 24 * 7) // 7天过期

    // 检查是否需要触发告警
    const count = await redis.get(key)
    if (count > 100) { // 如果同一类错误在一天内出现超过100次
      // 触发告警
      await triggerAlert({
        type: 'error_threshold',
        message: `Error ${errorData.name} occurred ${count} times today`,
        error: errorData
      })
    }

    res.status(200).json({ message: 'Error reported successfully' })
  } catch (err) {
    logger.error('Error while processing error report', { error: err })
    res.status(500).json({ error: 'Failed to process error report' })
  }
})

// 获取错误统计
app.get('/errors/stats', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 24 * 60 * 60 * 1000 // 默认24小时
    const stats = await aggregateErrors(timeRange)
    res.json(stats)
  } catch (err) {
    logger.error('Error while getting error stats', { error: err })
    res.status(500).json({ error: 'Failed to get error stats' })
  }
})

// 获取性能指标
app.get('/performance', async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 24 * 60 * 60 * 1000
    const startTime = new Date(Date.now() - timeRange)

    const performanceData = await Error.aggregate([
      {
        $match: {
          timestamp: { $gte: startTime },
          'breadcrumbs.category': 'performance'
        }
      },
      {
        $unwind: '$breadcrumbs'
      },
      {
        $match: {
          'breadcrumbs.category': 'performance'
        }
      },
      {
        $group: {
          _id: '$breadcrumbs.message',
          avgDuration: { $avg: '$breadcrumbs.data.duration' },
          maxDuration: { $max: '$breadcrumbs.data.duration' },
          count: { $sum: 1 }
        }
      }
    ])

    res.json(performanceData)
  } catch (err) {
    logger.error('Error while getting performance data', { error: err })
    res.status(500).json({ error: 'Failed to get performance data' })
  }
})

// 告警配置
const alertConfig = {
  errorThreshold: 100, // 错误数量阈值
  memoryThreshold: 0.9, // 内存使用率阈值
  performanceThreshold: 1000 // 性能阈值（毫秒）
}

// 告警处理函数
async function triggerAlert(alert) {
  try {
    // 记录告警
    logger.warn('Alert triggered', { alert })

    // 可以在这里添加其他告警方式，如：
    // - 发送邮件
    // - 发送 Slack 消息
    // - 发送 WebHook
    // - 触发 PagerDuty
    // 等等...

    // 示例：将告警保存到 Redis（用于告警收敛）
    const alertKey = `alert:${alert.type}:${new Date().toISOString().split('T')[0]}`
    await redis.incr(alertKey)
    await redis.expire(alertKey, 60 * 60 * 24) // 24小时过期
  } catch (err) {
    logger.error('Error while triggering alert', { error: err })
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Error collector service running on port ${PORT}`)
  logger.info(`Error collector service started on port ${PORT}`)
}) 