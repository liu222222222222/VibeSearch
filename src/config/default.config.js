// 默认配置
module.exports = {
  // 阿里云百炼 API 配置
  // 获取 API Key: https://www.aliyun.com/product/bailian
  // 免费额度：每 5 小时 1200 次
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || 'YOUR_DASHSCOPE_API_KEY_HERE',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    model: 'qwen3.5-plus'
  },

  // GitHub API 配置
  // 获取 Token: https://github.com/settings/tokens (需要 repo 权限)
  // 有 Token: 5000次/小时 | 无 Token: 60次/小时
  github: {
    baseUrl: 'https://api.github.com',
    token: process.env.GITHUB_TOKEN || 'YOUR_GITHUB_TOKEN_HERE'
  },

  // 服务器配置
  server: {
    port: 80,
    host: '0.0.0.0'
  },

  // 数据存储配置
  storage: {
    dataDir: './data',
    historyFile: './data/search_history.json',
    savedReposFile: './data/saved_repos.json'
  }
};