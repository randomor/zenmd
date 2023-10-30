import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const normalizePath = (pathName) => {
  return pathName.trim().replace(/(\s|%20)/g, '-').toLowerCase();
}

export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLayout = path.join(__dirname, './static/default_layout.html');

export const findLayout = async (currentFile, inputFolder, layoutName = 'layout.html') => {
  
  let currentDir = currentFile;
  do {
    currentDir = path.dirname(currentDir);
    const filePath = path.join(currentDir, layoutName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  } while (path.resolve(currentDir) !== path.resolve(inputFolder));

  return Promise.resolve(defaultLayout);
}