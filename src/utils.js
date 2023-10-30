import fs from 'fs/promises';
import path from 'path';

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

const defaultLayout = './src/static/default_layout.html';

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