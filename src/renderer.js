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

  marked.setOptions({ renderer });

  const wikiLink = {
    name: 'wikiLink',
    level: 'inline', // It is an inline-level tokenizer
    start(src) { return src.match(/\[\[/)?.index; }, // Check for the existence of "[[" to start the matching
    tokenizer(src, tokens) {
      const rule = /^\[\[(.*?)\]\]/; // Regular expression to capture the wiki link
      const match = rule.exec(src);
      if (match) {
        return { // Token to generate
          type: 'wikiLink', // Should match "name" above
          raw: match[0], // Text matched by the tokenizer
          text: match[1].trim(), // Captured group inside the [[]]
        };
      }
    },
    renderer(token) {
      return `<a href="/${token.text}.html">${token.text}</a>`; // How the wiki link will be converted to HTML
    },
  };

  marked.use({ extensions: [wikiLink] });

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