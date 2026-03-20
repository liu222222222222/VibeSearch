/**
 * 敏感词过滤工具
 * 使用开源敏感词库进行过滤
 */

// 常见敏感词库（基于开源项目）
const sensitiveWords = [
  // 政治敏感词
  '法轮功', '邪教', '恐怖主义', '暴力', '炸弹', '炸药',
  '枪支', '武器', '自杀', '自残',

  // 色情相关
  '色情', '淫秽', '裸体', '性交', '做爱', '黄片', 'AV',
  '成人片', '黄色网站', '色情网站',

  // 违法相关
  '赌博', '博彩', '六合彩', '时时彩', '赌球', '赌钱',
  '代开', '发票', '假发票', '办证', '身份证', '信用卡',
  '套现', '洗钱', '诈骗', '传销', '非法集资',

  // 恶意软件
  '木马', '病毒', '蠕虫', '黑客', '入侵', '攻击',
  'DDoS', '钓鱼', '木马程序', '病毒代码',

  // 毒品相关
  '毒品', '大麻', '海洛因', '冰毒', '摇头丸', 'K粉',
  '吸毒', '贩毒',

  // 广告营销
  '兼职', '刷单', '刷信誉', '代练', '代刷', '点赞',
  '涨粉', '买粉', '加粉', '推广', '广告', '微商',

  // 其他违规
  '代考', '作弊', '枪手', '论文代写', '代写论文',
  '假文凭', '假学历', '办假证',

  // 极端主义
  '纳粹', '种族主义', '歧视', '仇恨', '杀人', '谋杀',
  '屠杀', '灭绝', '种族清洗'
];

// 将敏感词按长度降序排序，优先匹配长词
sensitiveWords.sort((a, b) => b.length - a.length);

/**
 * 检查文本是否包含敏感词
 * @param {string} text - 要检查的文本
 * @returns {boolean} 是否包含敏感词
 */
function containsSensitiveWord(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();

  for (const word of sensitiveWords) {
    if (lowerText.includes(word.toLowerCase())) {
      console.log(`发现敏感词: ${word}`);
      return true;
    }
  }

  return false;
}

/**
 * 过滤敏感词（替换为 ***）
 * @param {string} text - 要过滤的文本
 * @returns {string} 过滤后的文本
 */
function filterSensitiveWords(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  for (const word of sensitiveWords) {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, '***');
  }

  return result;
}

/**
 * 添加自定义敏感词
 * @param {string} word - 要添加的敏感词
 */
function addSensitiveWord(word) {
  if (word && typeof word === 'string' && !sensitiveWords.includes(word)) {
    sensitiveWords.push(word);
    sensitiveWords.sort((a, b) => b.length - a.length);
  }
}

/**
 * 获取所有敏感词
 * @returns {Array<string>} 敏感词列表
 */
function getAllSensitiveWords() {
  return [...sensitiveWords];
}

module.exports = {
  containsSensitiveWord,
  filterSensitiveWords,
  addSensitiveWord,
  getAllSensitiveWords
};