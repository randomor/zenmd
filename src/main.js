import path from 'path';
import { glob } from 'glob';
import { fileToHtml } from './renderer.js';
import { normalizePath, fileExists } from './utils.js';

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