import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';
import { fileToHtml } from './renderer.js';

const normalizePath = (pathName) => {
  return pathName.replace(/ /g, '-').trim().toLowerCase();
}

// Load Markdown file and convert it to HTML
export const processFolder = async (inputFolder, outputFolder, options = {}) => {
  try {
    const globOptions = {
      cwd: process.cwd(),
    };
    const inputGlob = path.join(inputFolder, '**/*.md');
    const files = await glob(inputGlob, globOptions);
    await Promise.all(files.map(async file => {
      const relativePath = path.relative(inputFolder, file);
      const outputFileFolder = path.join(outputFolder, path.dirname(normalizePath(relativePath)));
      const templatePath = await findLayout(file, inputFolder);
      return fileToHtml(file, outputFileFolder, { templatePath, ...options });
    }));
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
  }
};

async function findLayout(currentFile, inputFolder, layoutName = 'layout.html') {
  // Helper function to check file existence
  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  let currentDir = currentFile;
  do {
    currentDir = path.dirname(currentDir);
    const filePath = path.join(currentDir, layoutName);
    if (await fileExists(filePath)) {
      return filePath;
    }
  } while (path.resolve(currentDir) !== path.resolve(inputFolder));

  return undefined;
}