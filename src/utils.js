import fs from 'fs/promises';

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