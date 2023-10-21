import path from 'path';
import { glob } from 'glob';
import { fileToHtml } from './renderer.js';

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
      const outputFileFolder = path.join(outputFolder, path.dirname(relativePath));
      const templatePath = await findLayout(file, inputFolder);
      return fileToHtml(file, outputFileFolder, { templatePath, ...options });
    }));
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
  }
};

async function findLayout(directory, inputFolder, filename = 'layout.html') {
  // Helper function to check file existence
  async function fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Check in the current directory
  let currentDir = directory;
  while (path.resolve(currentDir) !== path.resolve(inputFolder)) {
    const filePath = path.join(currentDir, filename);
    if (await fileExists(filePath)) {
      return filePath;
    }
    // Move up to the parent directory
    currentDir = path.dirname(currentDir);
  }

  // Check in the inputFolder as well
  const filePath = path.join(inputFolder, filename);
  if (await fileExists(filePath)) {
    return filePath;
  }

  return undefined;
}