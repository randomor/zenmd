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
const matrixLayout = path.join(__dirname, './static/matrix_layout.html');

/**
 * Find a custom layout.html in the directory tree; if none found,
 * fall back to a built-in layout based on the requested option.
 * @param currentFile - the source markdown file path
 * @param inputFolder - the root input folder for custom layouts
 * @param layoutOption - 'default' or 'matrix'
 */
export const findLayout = async (
  currentFile,
  inputFolder,
  layoutOption = 'default'
) => {
  // Search for a custom layout.html in current or parent directories
  let currentDir = currentFile;
  const customName = 'layout.html';
  do {
    currentDir = path.dirname(currentDir);
    const filePath = path.join(currentDir, customName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  } while (path.resolve(currentDir) !== path.resolve(inputFolder));

  // No custom layout found: use built-in default or matrix layout
  if (layoutOption === 'matrix') {
    return matrixLayout;
  }
  return defaultLayout;
};

export const isUrl = (string) => {
  try {
    new URL(string);
  } catch (_) {
    return false;
  }
  return true;
};
