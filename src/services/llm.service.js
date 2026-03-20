const axios = require('axios');
const https = require('https');
const http = require('http');
const config = require('../config/default.config');

// 禁用 HTTP Keep-Alive，避免连接复用问题
const httpsAgent = new https.Agent({ keepAlive: false });
const httpAgent = new http.Agent({ keepAlive: false });

// 百炼 API 提示词
const SYSTEM_PROMPT = `你是 GitHub 代码搜索专家。将用户查询转换为 GitHub 搜索查询。

输出 JSON 格式：
{
  "intent": "搜索意图",
  "chinese_keywords": ["中文关键词"],
  "english_keywords": ["英文关键词"],
  "search_queries": ["查询1", "查询2", ...]
}

search_queries 要求：
- 第1个必须是精确的项目全名：owner/repo
- 包含中文、英文、技术栈组合
- 使用 language:、NOT is:fork 等语法
- 至少8个查询

示例：PentaFlow
search_queries: ["liu222222222222/PentaFlow", "user:liu222222222222 PentaFlow", "PentaFlow FastAPI multi-agent", "\"PentaFlow\" \"多智能体\" \"五维推演\"", "language:python PentaFlow FastAPI", "\"AI agent\" \"多智能体\" \"事件分析\" FastAPI", "PentaFlow WebSocket async", "\"multi-agent\" \"事件影响力分析\" FastAPI"]`;

/**
 * 调用阿里云百炼 API 进行语义分析
 * @param {string} query - 用户输入的查询
 * @param {string} apiKey - API Key（可选，默认使用配置中的）
 * @param {string} baseUrl - 接口地址（可选，默认使用配置中的）
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeQuery(query, apiKey = null, baseUrl = null) {
  const actualApiKey = apiKey || config.dashscope.apiKey;
  const actualBaseUrl = baseUrl || config.dashscope.baseUrl;
  const maxRetries = 3; // 最大重试次数

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`准备调用阿里云百炼 API，查询: ${query} (尝试 ${attempt}/${maxRetries})`);
      console.log(`API URL: ${actualBaseUrl}/chat/completions`);
      console.log(`API Key: ${actualApiKey.substring(0, 10)}...`);
      console.log(`Model: ${config.dashscope.model}`);
      console.log(`Timeout: 60000ms`);

      const response = await axios.post(
        `${actualBaseUrl}/chat/completions`,
        {
          model: config.dashscope.model,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            {
              role: 'user',
              content: `分析用户查询：${query}`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          enable_thinking: false  // 禁用思考模式，避免超时
        },
        {
                headers: {
                  'Authorization': `Bearer ${actualApiKey}`,
                  'Content-Type': 'application/json'
                },
                httpsAgent,
                httpAgent,
                timeout: 60000  // 60秒，配合重试机制应该足够
              }      );

      console.log('阿里云百炼 API 调用成功，正在解析响应...');

      const content = response.data.choices[0].message.content;

      // 尝试解析 JSON
      try {
        // 提取 JSON 部分（可能包含其他文本）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('无法解析 JSON 响应');
      } catch (parseError) {
        console.error('解析百炼 API 响应失败:', parseError);
        console.error('原始响应:', content);
        throw new Error('API 返回格式错误');
      }
    } catch (error) {
      console.error(`调用百炼 API 失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
      
      // 判断是否可以重试
      const isRetryable = error.code === 'ECONNABORTED' || // 超时
                          error.code === 'ECONNRESET' ||    // 连接重置
                          error.code === 'ETIMEDOUT' ||     // 网络超时
                          error.code === 'ENOTFOUND' ||     // DNS解析失败
                          error.code === 'ECONNREFUSED' ||  // 连接被拒绝
                          (error.response && [502, 503, 504].includes(error.response.status)); // 服务器错误
      
      if (!isRetryable) {
        // 不可重试的错误，直接抛出
        if (error.response) {
          const status = error.response.status;
          console.error('API 响应状态:', status);
          console.error('API 响应数据:', error.response.data);
          
          if (status === 401) {
            throw new Error('API Key 无效或已过期，请检查您的 API Key');
          } else if (status === 403) {
            throw new Error('API 被限制访问，请检查 API Key 配额或联系服务商');
          } else if (status === 429) {
            throw new Error('API 调用频率超限，请稍后重试或使用自定义 API Key');
          }
        }
        throw new Error(`语义分析失败: ${error.message}`);
      }
      
      // 可以重试的错误
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 指数退避：1秒、2秒、4秒
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // 已达到最大重试次数
        throw new Error(`语义分析失败: ${error.message}（已重试 ${maxRetries} 次）`);
      }
    }
  }
}

module.exports = {
  analyzeQuery
};