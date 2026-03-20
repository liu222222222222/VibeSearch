# VibeSearch - AI 编程搜索引擎

一个基于 AI 语义分析的 GitHub 项目搜索引擎，通过阿里云百炼大模型对用户查询进行智能分析，在 GitHub 和 ClawHub 上搜索相关代码项目。

## 功能特性

- **智能语义分析**：使用阿里云百炼 qwen3.5-plus 模型对搜索词进行语义理解和重整
- **多源搜索**：同时支持 GitHub 仓库和 ClawHub Skills 搜索
- **中文优化**：支持中文关键词搜索，自动过滤中文相关项目
- **技术栈识别**：自动提取项目使用的技术栈标签
- **搜索历史**：本地保存搜索历史记录
- **自定义 API Key**：支持使用自己的 API Key 提高调用额度

## 技术栈

- **后端**：Node.js + Express.js
- **前端**：原生 HTML/CSS/JavaScript
- **AI 模型**：阿里云百炼 qwen3.5-plus
- **数据源**：GitHub API、ClawHub

## 快速开始

### 环境要求

- Node.js >= 16.x
- npm >= 8.x

### 安装依赖

```bash
npm install
```

### 配置 API Key

在 `src/config/default.config.js` 中配置你的 API Key：

```javascript
// 阿里云百炼 API 配置
dashscope: {
  apiKey: 'YOUR_DASHSCOPE_API_KEY_HERE',  // 替换为你的 API Key
  baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
  model: 'qwen3.5-plus'
},

// GitHub API 配置
github: {
  baseUrl: 'https://api.github.com',
  token: 'YOUR_GITHUB_TOKEN_HERE'  // 可选，提高速率限制
},
```

或者使用环境变量：

```bash
# 创建 .env 文件
DASHSCOPE_API_KEY=your_dashscope_api_key
GITHUB_TOKEN=your_github_token
```

### 启动服务

```bash
node index.js
```

访问 http://localhost 即可使用。

## API Key 获取方式

### 阿里云百炼 API Key

1. 访问 [阿里云百炼](https://www.aliyun.com/product/bailian)
2. 注册/登录阿里云账号
3. 开通百炼服务
4. 在控制台获取 API Key

**免费额度**：每 5 小时 1200 次调用

### GitHub Token（可选）

1. 访问 [GitHub Token 设置](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 生成并保存 Token

**速率限制对比**：
- 无 Token：60 次/小时
- 有 Token：5000 次/小时

## 项目结构

```
vibecoding-search/
├── index.js              # 入口文件
├── package.json          # 项目配置
├── public/
│   └── index.html        # 前端页面
├── src/
│   ├── config/
│   │   └── default.config.js   # 配置文件（API Key 在此配置）
│   ├── routes/
│   │   └── api.js              # API 路由
│   ├── services/
│   │   ├── llm.service.js      # 阿里云百炼服务
│   │   ├── github.service.js   # GitHub API 服务
│   │   └── clawhub.service.js  # ClawHub 服务
│   └── utils/
│       ├── sensitive.js        # 敏感词过滤
│       └── storage.js          # 本地存储
├── data/                 # 数据目录（自动生成）
│   ├── search_history.json
│   └── saved_repos.json
└── logs/                 # 日志目录
```

## API 接口

### 搜索接口

```
POST /api/search
Content-Type: application/json

{
  "query": "多智能体系统",
  "apiKey": "可选，自定义百炼 API Key",
  "githubToken": "可选，GitHub Token",
  "onlyChinese": false,
  "searchGitHub": true,
  "searchClawHub": true
}
```

### 搜索历史

```
GET /api/history
```

### 配置信息

```
GET /api/config
```

## 常见问题

### 搜索超时

阿里云百炼 API 响应可能较慢（1-5 分钟），请耐心等待。如果遇到网络错误，等待 30 秒后重试。

### API 限流

- 百炼 API：每 5 小时 1200 次，超限后使用自定义 API Key
- GitHub API：无 Token 时 60 次/小时，建议配置 Token

### 中文搜索效果不佳

勾选"仅中文"选项可以过滤出更相关的中文项目。

## 项目地址

GitHub: https://github.com/liu222222222222/vibesearch

## License

[MIT](LICENSE)
