import fs from 'fs/promises';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkWikiLink from 'remark-wiki-link';
import remarkFrontmatter from 'remark-frontmatter';
import path from 'path';
import mustache from 'mustache';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import {visit} from 'unist-util-visit';

const pageNameToFileName = (pageName) => {
  return pageName.replace(/ /g, '-').trim().toLowerCase();
}

export const configRenderer = (currentFile, outputFileFolder, imageDir = '') => {
  const processor = remark()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkWikiLink, { 
        pageResolver: (name) => [pageNameToFileName(name)],
        hrefTemplate: (permalink) => `${permalink}.html`
    })
    .use(() => (tree) => {
      visit(tree, 'image', async (node) => {
        const targetHref = path.join(imageDir, node.url);
        const outputPath = path.join(outputFileFolder, imageDir, node.url);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        const currentFileDir = path.dirname(currentFile);
        const imagePath = path.join(currentFileDir, node.url);
        await fs.copyFile(imagePath, outputPath);
        node.url = `./${targetHref}`;
      });
      visit(tree, 'link', (node) => {
        // all relative path to .md will just be simply replaced with .html
        if (node.url.startsWith('.') && node.url.endsWith('.md')) {
          node.url = node.url.replace('.md', '.html');
        }
      });
    })
    .use(remarkHtml);

  return processor;
};

export const fileToHtml = async (inputFile, outputFileFolder, options = {}) => {
  chalk.blue("Converting: ", inputFile, outputFileFolder);
  try {
    const data = await fs.readFile(inputFile, 'utf8');
    const processor = await configRenderer(inputFile, outputFileFolder);
    const file = await processor.process(data);
    const frontMatter = file.data.frontmatter || {};
    const htmlContent = String(file.value);

    if (Object.keys(frontMatter).length > 0) {
      console.log(chalk.blueBright('Front Matter:'), frontMatter);
    }

    const inputFileName = pageNameToFileName(path.parse(inputFile).name);
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

const renderHtml = async (templatePath, { title, content }) => {
  templatePath = templatePath || path.join(__dirname, './static/default_layout.html');
  const template = await fs.readFile(templatePath, 'utf8');
  const rendered = mustache.render(template, { title, content });
  return rendered;
};
