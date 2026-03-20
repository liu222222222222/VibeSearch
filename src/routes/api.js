const express = require('express');
const router = express.Router();
const llmService = require('../services/llm.service');
const githubService = require('../services/github.service');
const clawhubService = require('../services/clawhub.service');
const storage = require('../utils/storage');
const config = require('../config/default.config');

/**
 * 搜索 API
 * POST /api/search
 * Body: { query, apiKey, baseUrl, githubToken, onlyChinese, searchGitHub, searchClawHub }
 */
router.post('/search', async (req, res) => {
  try {
    const { query, apiKey, baseUrl, githubToken, onlyChinese = false, searchGitHub = true, searchClawHub = true } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: '请输入搜索关键词' });
    }

    console.log(`开始搜索: ${query} (GitHub: ${searchGitHub}, ClawHub: ${searchClawHub})`);

    // 如果两个都没勾选，返回错误
    if (!searchGitHub && !searchClawHub) {
      return res.status(400).json({ error: '请至少选择一个搜索来源' });
    }

    let results = [];

    // 并行搜索 GitHub 和 ClawHub
    const searchPromises = [];

    if (searchGitHub) {
      searchPromises.push(searchGitHubRepos(query, apiKey, baseUrl, githubToken, onlyChinese));
    }

    if (searchClawHub) {
      searchPromises.push(searchClawHubSkills(query));
    }

    // 等待所有搜索完成
    const searchResults = await Promise.all(searchPromises);
    console.log('搜索完成，结果数量:', searchResults.map(r => r.length));

    // 合并结果
    console.log('开始合并结果...');
    searchResults.forEach((result, idx) => {
      console.log(`结果 ${idx}: ${result.length} 个项目`);
      results = results.concat(result);
    });

    // 如果仅显示中文，过滤非中文项目
    const finalResults = onlyChinese
      ? results.filter(item => item.chinese_score > 0)
      : results;

    // 保存搜索历史
    await storage.addSearchHistory(query, apiKey, finalResults.length);

    res.json({
      success: true,
      results: finalResults,
      filteredCount: results.length - finalResults.length
    });
  } catch (error) {
    console.error('搜索失败:', error);
    console.error('错误堆栈:', error.stack);

    let errorMessage = error.message || '未知错误';
    let errorSource = 'unknown';
    let suggestions = [];

    // 判断错误来源
    if (error.message && (error.message.includes('语义分析失败') || error.message.includes('API') || error.message.includes('timeout'))) {
      errorSource = 'LLM';

      if (error.message.includes('timeout')) {
        errorMessage = '阿里云百炼 API 响应超时';
        suggestions = [
          '网络连接不稳定，请稍后重试',
          '阿里云百炼 API 服务端响应慢',
          '建议使用自定义 API Key 提高可靠性'
        ];
      } else if (error.message.includes('401')) {
        errorMessage = '阿里云百炼 API Key 无效或已过期';
        suggestions = [
          '请检查 API Key 是否正确',
          'API Key 可能已过期，请重新获取',
          '访问 https://www.aliyun.com/product/bailian 获取新 Key'
        ];
      } else if (error.message.includes('403')) {
        errorMessage = '阿里云百炼 API 访问受限';
        suggestions = [
          'API Key 配额可能已用完（每 5 小时 1200 次）',
          '建议使用自定义 API Key',
          '联系服务商增加配额'
        ];
      } else if (error.message.includes('429')) {
        errorMessage = '阿里云百炼 API 调用频率超限';
        suggestions = [
          '请求过于频繁，请稍后重试',
          '建议使用自定义 API Key 提高配额'
        ];
      }
    } else if (error.message && (error.message.includes('GitHub') || error.message.includes('403') || error.message.includes('401'))) {
      errorSource = 'GitHub';

      if (error.message.includes('403')) {
        errorMessage = 'GitHub API 速率限制';
        suggestions = [
          '无 GitHub Token：60 次/小时',
          '有 GitHub Token：5000 次/小时',
          '建议使用 GitHub Token 提高速率限制',
          '等待速率限制重置'
        ];
      } else if (error.message.includes('401')) {
        errorMessage = 'GitHub Token 无效或已过期';
        suggestions = [
          '请检查 GitHub Token 是否正确',
          'Token 可能已过期，请重新生成',
          '访问 https://github.com/settings/tokens 获取新 Token'
        ];
      }
    } else if (error.message && error.message.includes('README')) {
      errorSource = 'GitHub';
      errorMessage = '获取项目 README 失败';
      suggestions = [
        '网络连接不稳定',
        'GitHub API 响应慢',
        '不影响搜索结果，已跳过'
      ];
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      errorSource: errorSource,
      suggestions: suggestions
    });
  }
});

/**
 * 搜索 GitHub 仓库
 */
async function searchGitHubRepos(query, apiKey, baseUrl, githubToken, onlyChinese) {
  // 1. 使用百炼 API 进行语义分析
  console.log('正在分析查询...');
  const analysis = await llmService.analyzeQuery(query, apiKey, baseUrl);
  console.log('分析结果:', analysis);

  // 2. 生成 GitHub 搜索查询
  const searchQueries = analysis.search_queries || [
    `language:python ${query}`,
    `${query} smart`,
    `${query} system`,
    `language:javascript ${query}`
  ];

  // 确保原始查询在搜索列表中
  if (!searchQueries.includes(query)) {
    searchQueries.unshift(query);
  }

  // 3. 在 GitHub 上搜索（使用 GitHub Token 提高速率限制）
  console.log('正在搜索 GitHub...');
  let results = await githubService.searchRepositories(searchQueries, 10, githubToken);

  // 4. 为前 5 个结果提取技术栈标签（提高速度）
  const topResults = results.slice(0, 5);
  for (const repo of topResults) {
    try {
      const [owner, repoName] = repo.full_name.split('/');
      const readme = await githubService.getReadme(owner, repoName, githubToken);
      repo.tech_stack = githubService.extractTechStack(readme) || [];
      repo.readme_content = readme || null;
      repo.match_score = calculateMatchScore(repo, analysis) || 0;
      repo.chinese_score = calculateChineseScore(repo) || 0;
    } catch (error) {
      console.error(`处理仓库 ${repo.full_name} 失败:`, error);
      repo.tech_stack = [];
      repo.readme_content = null;
      repo.match_score = 0;
      repo.chinese_score = 0;
    }
  }

  // 为其他结果计算基本分数
  for (const repo of results.slice(5)) {
    try {
      repo.tech_stack = [];
      repo.readme_content = null;
      repo.match_score = calculateMatchScore(repo, analysis) || 0;
      repo.chinese_score = calculateChineseScore(repo) || 0;
    } catch (error) {
      console.error(`计算仓库 ${repo.full_name} 分数失败:`, error);
      repo.tech_stack = [];
      repo.readme_content = null;
      repo.match_score = 0;
      repo.chinese_score = 0;
    }
  }

  // 5. 过滤敏感词（仅过滤搜索结果）
  const sensitiveCheck = require('../utils/sensitive');
  const filteredResults = results.filter(repo => {
    try {
      const textToCheck = [
        repo.name || '',
        repo.description || '',
        repo.readme_content || ''
      ].join(' ');
      return !sensitiveCheck.containsSensitiveWord(textToCheck);
    } catch (error) {
      console.error('过滤敏感词失败:', error);
      return true; // 如果过滤失败，保留结果
    }
  });

  // 添加 type 标识
  filteredResults.forEach(repo => {
    repo.type = 'github';
  });

  // 6. 如果仅显示中文，过滤非中文项目
  const finalResults = onlyChinese
    ? filteredResults.filter(repo => repo.chinese_score > 0)
    : filteredResults;

  // 7. 按中文相关性、星星数、更新时间排序（中文优先）
  finalResults.sort((a, b) => {
    const chineseWeight = 0.5;  // 中文相关性权重提高到 50%
    const starsWeight = 0.3;    // 星星数权重降低到 30%
    const timeWeight = 0.2;     // 更新时间权重降低到 20%

    const chineseScoreA = a.chinese_score * chineseWeight;
    const chineseScoreB = b.chinese_score * chineseWeight;

    const starsScoreA = Math.log10(a.stars + 1) * starsWeight;
    const starsScoreB = Math.log10(b.stars + 1) * starsWeight;

    const timeScoreA = calculateTimeScore(a.updated_at) * timeWeight;
    const timeScoreB = calculateTimeScore(b.updated_at) * timeWeight;

    const scoreA = chineseScoreA + starsScoreA + timeScoreA;
    const scoreB = chineseScoreB + starsScoreB + timeScoreB;

    return scoreB - scoreA;
  });

  return finalResults;
}

/**
 * 搜索 ClawHub Skills
 */
async function searchClawHubSkills(query) {
  try {
    console.log('正在搜索 ClawHub...');
    const skills = await clawhubService.searchSkills(query, 10);
    console.log(`ClawHub 返回 ${skills.length} 个结果`);

    // 为每个 skill 添加中文分数（用于筛选）
    skills.forEach(skill => {
      skill.chinese_score = calculateChineseScore(skill);
    });

    return skills;
  } catch (error) {
    console.error('ClawHub 搜索出错:', error.message);
    // 返回空数组而不是抛出异常，避免影响其他搜索
    return [];
  }
}

/**
 * 获取搜索历史
 * GET /api/history
 */
router.get('/history', async (req, res) => {
  try {
    const history = await storage.getSearchHistory();
    res.json({ success: true, history });
  } catch (error) {
    console.error('获取历史失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



/**
 * 获取配置信息
 * GET /api/config
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      hasDefaultApiKey: !!config.dashscope.apiKey,
      baseUrl: config.dashscope.baseUrl
    }
  });
});

/**
 * 获取 ClawHub Skill 作者信息
 * GET /api/clawhub-author/:slug
 */
router.get(/^\/clawhub-author\/(.+)$/, async (req, res) => {
  try {
    const slug = req.params[0];
    const author = await clawhubService.getSkillAuthor(slug);

    if (author) {
      res.json({ success: true, author });
    } else {
      res.json({ success: false, author: null });
    }
  } catch (error) {
    console.error('获取ClawHub作者信息失败:', error);
    res.json({ success: false, author: null });
  }
});

/**
 * 计算匹配度分数
 */
function calculateMatchScore(repo, analysis) {
  let score = 0;

  // 如果 analysis 为 null，返回 0
  if (!analysis) {
    return 0;
  }

  // 描述匹配（使用英文关键词）
  if (repo.description && analysis.english_keywords) {
    const desc = repo.description.toLowerCase();
    const matches = analysis.english_keywords.filter(kw =>
      desc.includes(kw.toLowerCase())
    ).length;
    score += matches * 0.5;
  }

  // 描述匹配（使用中文关键词）
  if (repo.description && analysis.chinese_keywords) {
    const desc = repo.description;
    const matches = analysis.chinese_keywords.filter(kw =>
      desc.includes(kw)
    ).length;
    score += matches * 0.3;
  }

  // 主题匹配
  if (repo.topics && analysis.english_keywords) {
    const matches = repo.topics.filter(topic =>
      analysis.english_keywords.some(kw =>
        topic.toLowerCase().includes(kw.toLowerCase())
      )
    ).length;
    score += matches * 0.8;
  }

  return score;
}

/**
 * 计算中文相关性分数
 */
function calculateChineseScore(repo) {
  let score = 0;

  // 检查项目名称是否包含中文
  if (repo.name && /[\u4e00-\u9fa5]/.test(repo.name)) {
    score += 0.5;
  }

  // 检查描述是否包含中文
  if (repo.description && /[\u4e00-\u9fa5]/.test(repo.description)) {
    score += 0.3;
  }

  // 检查 README 是否包含中文
  if (repo.readme_content) {
    const chineseChars = (repo.readme_content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const totalChars = repo.readme_content.length;
    if (totalChars > 0) {
      const chineseRatio = chineseChars / totalChars;
      if (chineseRatio > 0.1) {
        score += Math.min(chineseRatio * 2, 1); // 最高加 1 分
      }
    }
  }

  // 检查常见的中文功能词（提高权重）
  const chineseFunctionWords = ['智能', '识别', '检测', '分析', '监控', '管理', '系统', '平台', '框架', '工具', '库', '模块'];
  const allText = [
    repo.name,
    repo.description,
    repo.readme_content || ''
  ].join(' ');

  const functionWordMatches = chineseFunctionWords.filter(word =>
    allText.includes(word)
  ).length;
  score += functionWordMatches * 0.15; // 每个功能词加 0.15 分

  return score;
}

/**
 * 计算时间分数（更新的项目得分更高）
 */
function calculateTimeScore(updatedAt) {
  const now = new Date();
  const updated = new Date(updatedAt);
  const daysDiff = (now - updated) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 1) return 1.0;
  if (daysDiff <= 7) return 0.8;
  if (daysDiff <= 30) return 0.6;
  if (daysDiff <= 90) return 0.4;
  if (daysDiff <= 365) return 0.2;
  return 0.1;
}

module.exports = router;