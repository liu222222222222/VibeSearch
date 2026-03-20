const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Node 路径
const NODE_PATH = '/home/ubuntu/.nvm/versions/node/v22.22.1/bin';
const PATH_ENV = `PATH=${NODE_PATH}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`;

/**
 * ClawHub 服务
 */

// 缓存作者信息
const authorCache = new Map();

/**
 * 搜索 ClawHub Skills
 */
async function searchSkills(keyword, limit = 10) {
  try {
    console.log(`正在搜索 ClawHub: ${keyword}`);

    const command = `${PATH_ENV} npx clawhub search "${keyword}"`;
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000,
      maxBuffer: 1024 * 1024
    });

    const skills = parseSearchOutput(stdout);
    console.log(`ClawHub 搜索完成，找到 ${skills.length} 个 skills`);

    // 异步获取作者信息（不阻塞返回）
    skills.forEach(skill => {
      getSkillAuthor(skill.slug).then(author => {
        if (author) {
          skill.author = author;
          skill.url = `https://clawhub.ai/${author}/${skill.slug}`;
        }
      }).catch(() => {});
    });

    return skills.slice(0, limit);
  } catch (error) {
    console.error('ClawHub 搜索失败:', error.message);
    return [];
  }
}

/**
 * 解析搜索输出
 */
function parseSearchOutput(output) {
  const skills = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(\S+)\s+(.+?)\s+\(([\d.]+)\)$/);

    if (match) {
      const [, slug, description, downloads] = match;
      skills.push({
        type: 'clawhub',
        slug: slug,
        name: slug,
        description: description.trim(),
        author: 'unknown',
        downloads: parseFloat(downloads) || 0,
        score: parseFloat(downloads) || 0,
        url: `https://clawhub.ai/${slug}`,
        installCommand: `clawhub install ${slug}`
      });
    }
  }

  skills.sort((a, b) => b.downloads - a.downloads);
  return skills;
}

/**
 * 获取 Skill 作者信息
 */
async function getSkillAuthor(slug) {
  // 检查缓存
  if (authorCache.has(slug)) {
    return authorCache.get(slug);
  }

  try {
    console.log(`正在获取 Skill 作者: ${slug}`);

    const command = `${PATH_ENV} npx clawhub inspect ${slug}`;
    const { stdout } = await execAsync(command, {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });

    // 提取 Owner
    const match = stdout.match(/Owner:\s*(\S+)/);
    
    if (match) {
      const author = match[1];
      console.log(`获取到作者: ${author}`);
      authorCache.set(slug, author);
      return author;
    }

    return null;
  } catch (error) {
    console.error('获取Skill作者失败:', error.message);
    return null;
  }
}

module.exports = {
  searchSkills,
  getSkillAuthor
};
