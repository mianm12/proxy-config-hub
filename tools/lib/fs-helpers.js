import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * 检查指定路径是否存在。
 * @param {string} targetPath - 待检查的文件或目录路径。
 * @returns {Promise<boolean>} 路径存在返回 true，否则返回 false。
 */
async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 列出目录中的所有条目；目录不存在时返回空数组。
 * @param {string} dir - 目标目录路径。
 * @returns {Promise<import("node:fs").Dirent[]>} 目录条目列表。
 */
async function listEntries(dir) {
  if (!(await pathExists(dir))) {
    return [];
  }

  return fs.readdir(dir, { withFileTypes: true });
}

/**
 * 递归复制目录及其全部内容。目标目录会被先清空再写入。
 * @param {string} sourceDir - 源目录路径。
 * @param {string} targetDir - 目标目录路径。
 * @returns {Promise<void>}
 */
async function copyDirectory(sourceDir, targetDir) {
  if (!(await pathExists(sourceDir))) {
    throw new Error(`源目录不存在: ${sourceDir}`);
  }

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

/**
 * 复制单个文件，自动创建目标目录。
 * @param {string} sourcePath - 源文件路径。
 * @param {string} targetPath - 目标文件路径。
 * @returns {Promise<void>}
 */
async function copyFile(sourcePath, targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

export { pathExists, listEntries, copyDirectory, copyFile };
