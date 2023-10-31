import path from 'path';
import { glob } from 'glob';
import { fileToHtml } from './renderer.js';

// Load Markdown file and convert it to HTML
export const processFolder = async (inputArg, outputFolder, options = { render: fileToHtml, tags }) => {
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
      return render(file, inputFolder, outputFolder, options);
    }));
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
  }
};