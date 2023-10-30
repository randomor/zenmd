import path from 'path';
import { glob } from 'glob';
import { fileToHtml } from './renderer.js';
import { fileExists } from './utils.js';

// Load Markdown file and convert it to HTML
export const processFolder = async (inputArg, outputFolder, options = { render: fileToHtml }) => {
  const render = options.render || fileToHtml;
  try {
    const globOptions = {
      cwd: process.cwd(),
    };
    const isFileArg = inputArg.endsWith('.md');
    const inputFolder = isFileArg ? path.dirname(inputArg) : inputArg;
    const inputGlob = isFileArg ? inputArg : path.join(inputFolder, '**/*.md');
    const files = await glob(inputGlob, globOptions);
    await Promise.all(files.map(async file => {
      const templatePath = await findLayout(file, inputFolder);
      return render(file, inputFolder, outputFolder, { templatePath, ...options });
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