const fs = require('fs').promises;
const path = require('path');
const config = require('../config/default.config');

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.mkdir(config.storage.dataDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

// 读取 JSON 文件
async function readJsonFile(filename) {
  await ensureDataDir();
  try {
    const data = await fs.readFile(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// 写入 JSON 文件
async function writeJsonFile(filename, data) {
  await ensureDataDir();
  await fs.writeFile(filename, JSON.stringify(data, null, 2), 'utf8');
}

// 添加搜索历史
async function addSearchHistory(query, apiKeyUsed, resultsCount) {
  const history = await readJsonFile(config.storage.historyFile);
  history.unshift({
    query,
    timestamp: new Date().toISOString(),
    resultsCount,
    apiKeyUsed: apiKeyUsed ? 'custom' : 'default'
  });
  // 只保留最近 50 条记录
  if (history.length > 50) {
    history.pop();
  }
  await writeJsonFile(config.storage.historyFile, history);
}

// 获取搜索历史
async function getSearchHistory() {
  return await readJsonFile(config.storage.historyFile);
}

// 保存仓库
async function saveRepo(repoId, repoData) {
  const savedRepos = await readJsonFile(config.storage.savedReposFile);
  if (!savedRepos.find(r => r.repoId === repoId)) {
    savedRepos.unshift({
      repoId,
      ...repoData,
      savedAt: new Date().toISOString()
    });
    await writeJsonFile(config.storage.savedReposFile, savedRepos);
    return true;
  }
  return false;
}

// 获取保存的仓库
async function getSavedRepos() {
  return await readJsonFile(config.storage.savedReposFile);
}

// 删除保存的仓库
async function deleteSavedRepo(repoId) {
  const savedRepos = await readJsonFile(config.storage.savedReposFile);
  const filtered = savedRepos.filter(r => r.repoId !== repoId);
  await writeJsonFile(config.storage.savedReposFile, filtered);
}

module.exports = {
  addSearchHistory,
  getSearchHistory,
  saveRepo,
  getSavedRepos,
  deleteSavedRepo
};