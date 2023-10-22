import fs from 'fs/promises';
import fsSync from 'fs';
import { marked } from 'marked';
import matter from 'gray-matter';
import path from 'path';
import mustache from 'mustache';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

export const configRenderer = (currentFile, outputFileFolder, imageDir = '') => {
  
  // Create a custom renderer
  const renderer = new marked.Renderer();

  // Override the image renderer
  renderer.image = (href, title, text) => {
    const targetHref = path.join(imageDir, href);
    // Create the output directory if it doesn't exist
    const outputPath = path.join(outputFileFolder, imageDir, href);

    fsSync.mkdirSync(path.dirname(outputPath), { recursive: true });
    // Get current file's directory
    const currentFileDir = path.dirname(currentFile);
    // Get the relative path from the current file to the image
    const imagePath = path.join(currentFileDir, href);

    // has to be sync as marked doesn't support async
    fsSync.copyFileSync(imagePath, outputPath);
    return `<img src="./${targetHref}" alt="${text}" title="${title || text}">`;
  };

  // Override the link renderer
  renderer.link = function (href, title, text) {
    // if href is a local file ending with .md, convert it to .html
    const isLocalMdFile = href.startsWith('.') && href.endsWith('.md');
    const targetHref = isLocalMdFile ? href.replace('.md', '.html') : href;
    return `<a href="${targetHref}" title="${title || text}">${text}</a>`;
  };

  renderer.text= function (text) {
    const regex = /\[\[(.*?)\]\]/g;
    return text.replace(regex, (match, p1) => `<a href="/${p1}.html">${p1}</a>`);
  }

  marked.setOptions({ renderer });

  return marked;
}

export const fileToHtml = async (inputFile, outputFileFolder, options = {}) => {
  chalk.blue("Converting: ", inputFile, outputFileFolder);
  try {
    const data = await fs.readFile(inputFile, 'utf8');

    const parsedMarkdown = matter(data);
      
    await configRenderer(inputFile, outputFileFolder);

    // Convert Markdown to HTML using marked
    const htmlContent = marked(parsedMarkdown.content);
    const frontMatter = parsedMarkdown.data;

    // if frontMatter is not empty, log it with chalk
    if (Object.keys(frontMatter).length > 0) {
      console.log(chalk.blueBright('Front Matter:'), frontMatter);
    }

    const inputFileName = path.parse(inputFile).name;

    const outputFileName = `${inputFileName}.html`;

    try {
      await fs.access(outputFileFolder);
    } catch (error) {
      await fs.mkdir(outputFileFolder, { recursive: true });
    }

    const { templatePath } = options;

    const htmlOutput = await renderHtml(templatePath, {title: 'Untitled', ...frontMatter, content: htmlContent});
    
    const outputFilePath = path.join(outputFileFolder, outputFileName);
    
    await fs.writeFile(outputFilePath, htmlOutput);

    console.log(chalk.greenBright(`Rendered: ${outputFilePath}`));
  } catch (err) {
    console.error(chalk.red(`Error processing file ${inputFile}:`), err);
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Wrap the HTML content with necessary HTML & Tailwind tags
const renderHtml = async (templatePath, { title, content }) => {
  templatePath = templatePath || path.join(__dirname, './static/default_layout.html');
  const template = await fs.readFile(templatePath, 'utf8');
  const rendered = mustache.render(template, { title, content });
  return rendered;
};