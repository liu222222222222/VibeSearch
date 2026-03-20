const axios = require('axios');
const https = require('https');
const http = require('http');
const config = require('../config/default.config');

// 禁用 HTTP Keep-Alive，避免连接复用问题
const httpsAgent = new https.Agent({ keepAlive: false });
const httpAgent = new http.Agent({ keepAlive: false });

/**
 * 在 GitHub 上搜索仓库
 * @param {Array<string>} searchQueries - 搜索查询列表
 * @param {number} perPage - 每页结果数
 * @param {string} githubToken - GitHub Token（可选）
 * @returns {Promise<Array>} 搜索结果列表
 */
async function searchRepositories(searchQueries, perPage = 10, githubToken = null) {
  const allResults = [];
  const seenRepos = new Set();

  // 优先使用用户提供的 token，否则使用配置中的 token
  const token = githubToken || config.github.token;

  for (const query of searchQueries) {
    try {
      const searchUrl = `${config.github.baseUrl}/search/repositories`;
      const params = {
        q: query,
        sort: 'stars',
        order: 'desc',
        per_page: perPage
      };

      // 如果有 GitHub token，添加认证
      const headers = {};
      if (token) {
        headers['Authorization'] = `token ${token}`;
      }

      const response = await axios.get(searchUrl, {
        params,
        headers,
        httpsAgent,
        httpAgent,
        timeout: 15000
      });

      if (response.data.items) {
        for (const item of response.data.items) {
          const repoId = item.full_name;
          if (!seenRepos.has(repoId)) {
            seenRepos.add(repoId);
            allResults.push({
              id: item.id,
              name: item.name,
              full_name: item.full_name,
              description: item.description,
              language: item.language,
              stars: item.stargazers_count,
              forks: item.forks_count,
              updated_at: item.updated_at,
              created_at: item.created_at,
              url: item.html_url,
              topics: item.topics || [],
              owner: {
                login: item.owner.login,
                avatar_url: item.owner.avatar_url
              }
            });
          }
        }
      }

      // 添加延迟避免速率限制（有 token 可以减少延迟）
      const delay = token ? 200 : 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.error(`GitHub 搜索失败（查询：${query}）:`, error.message);
      if (error.response) {
        const status = error.response.status;
        if (status === 403) {
          const remaining = error.response.headers.get('X-RateLimit-Remaining');
          const reset = error.response.headers.get('X-RateLimit-Reset');
          const resetTime = reset ? new Date(reset * 1000).toLocaleString('zh-CN') : '未知';
          console.error(`GitHub API 速率限制: 剩余 ${remaining} 次，重置时间 ${resetTime}`);
          if (!token) {
            console.error('建议使用 GitHub Token 提高速率限制到 5000 次/小时');
          }
        } else if (status === 401) {
          console.error('GitHub Token 无效或已过期');
        }
      }
      // 继续尝试其他查询
    }
  }

  // 按星星数量排序
  return allResults.sort((a, b) => b.stars - a.stars);
}

/**
 * 获取仓库的 README 内容
 * @param {string} owner - 仓库所有者
 * @param {string} repo - 仓库名称
 * @param {string} githubToken - GitHub Token（可选）
 * @returns {Promise<string|null>} README 内容
 */
async function getReadme(owner, repo, githubToken = null) {
  try {
    const url = `${config.github.baseUrl}/repos/${owner}/${repo}/readme`;
    const headers = {
      'Accept': 'application/vnd.github.v3.raw'
    };

    // 优先使用用户提供的 token，否则使用配置中的 token
    const token = githubToken || config.github.token;
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await axios.get(url, { headers, httpsAgent, httpAgent, timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error(`获取 README 失败（${owner}/${repo}）:`, error.message);
    return null;
  }
}

/**
 * 从 README 中提取技术栈标签
 * @param {string} readmeContent - README 内容
 * @returns {Array<string>} 技术栈标签
 */
function extractTechStack(readmeContent) {
  if (!readmeContent) return [];

  const techStack = new Set();
  const content = readmeContent.toLowerCase();

  // 常见编程语言和框架
  const commonTech = [
    'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'c#',
    'react', 'vue', 'angular', 'node.js', 'express', 'fastapi', 'flask', 'django',
    'tensorflow', 'pytorch', 'keras', 'scikit-learn',
    'docker', 'kubernetes', 'redis', 'mongodb', 'postgresql', 'mysql',
    'yolov8', 'opencv', 'pandas', 'numpy', 'matplotlib',
    'ai', 'machine learning', 'deep learning', 'nlp', 'computer vision',
    'websocket', 'rest api', 'graphql', 'grpc', 'mqtt',
    'linux', 'windows', 'android', 'ios', 'web', 'mobile'
  ];

  for (const tech of commonTech) {
    if (content.includes(tech)) {
      techStack.add(tech);
    }
  }

  // 检测 badges（如 ![Python](https://img.shields.io/badge/Python-blue)）
  const badgePattern = /!\[.*?\]\(.*?badge.*?\)/gi;
  const badges = readmeContent.match(badgePattern) || [];
  for (const badge of badges) {
    const tech = badge.match(/\b(python|javascript|typescript|java|go|rust|react|vue|angular|node\.js|fastapi|flask|django)\b/i);
    if (tech) {
      techStack.add(tech[1].toLowerCase());
    }
  }

  return Array.from(techStack);
}

module.exports = {
  searchRepositories,
  getReadme,
  extractTechStack
};