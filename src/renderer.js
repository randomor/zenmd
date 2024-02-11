import fs from 'fs/promises';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import remarkWikiLink from 'remark-wiki-link';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParseFrontmatter from 'remark-parse-frontmatter'
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeInferTitleMeta from 'rehype-infer-title-meta'
import path from 'path';
import mustache from 'mustache';
import chalk from 'chalk';
import {visit} from 'unist-util-visit';
import { normalizePath, findLayout } from './utils.js';

export const configRenderer = (currentFile, inputFolder, outputFileFolder, imageDir = '') => {

  const relativePathToInputFolder = path.relative(path.dirname(currentFile), inputFolder);

  const processor = remark()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkParseFrontmatter)
    .use(remarkWikiLink, { 
        pageResolver: (name) => [path.join(relativePathToInputFolder, normalizePath(name))],
        hrefTemplate: (permalink) => `${permalink}.html`
    })
    .use(remarkGfm)
    .use(() => (tree) => {
      visit(tree, 'image', async (node) => {
        const decodedUrl = decodeURI(node.url);
        const targetHref = path.join(imageDir, decodedUrl);
        const outputPath = path.join(outputFileFolder, imageDir, decodedUrl);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        const currentFileDir = path.dirname(currentFile);
        const imagePath = path.join(currentFileDir, decodedUrl);
        await fs.copyFile(imagePath, outputPath);
        node.url = `./${targetHref}`;
      });
      visit(tree, 'link', (node) => {
        // all current domain path (path that begins with `.` or `/`) with extension .md will be replaced with .html
        if (/^[./].*\.md$/.test(node.url)) {
          node.url = normalizePath(node.url).replace(".md", ".html");
        }
      });
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(() => (tree) => {
      visit(tree, ['image', 'element'], async (node) => {
        if (node.tagName === 'img') {
          const decodedUrl = decodeURI(node.properties.src);
          const targetHref = path.join(imageDir, decodedUrl);
          const outputPath = path.join(outputFileFolder, imageDir, decodedUrl);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          const currentFileDir = path.dirname(currentFile);
          const imagePath = path.join(currentFileDir, decodedUrl);
          await fs.copyFile(imagePath, outputPath);
          node.properties.src = `./${targetHref}`;
        }
      });
    })
    .use(rehypeAutolinkHeadings, {
        behavior: 'append'
      })
    .use(rehypeInferTitleMeta)
    .use(rehypeStringify, {allowDangerousHtml: true});

  return processor;
};

export const fileToHtml = async (inputFile, inputFolder, outputFolder, options = { tags: [] }) => {
  const relativePath = path.relative(inputFolder, inputFile);
  const outputFileFolder = path.join(outputFolder, path.dirname(normalizePath(relativePath)));
  const inputFileName = normalizePath(path.parse(inputFile).name);
  const outputFileName = `${inputFileName}.html`;
  const outputFilePath = path.join(outputFileFolder, outputFileName);

  chalk.blue("Converting: ", inputFile, outputFileFolder);
  try {
    const data = await fs.readFile(inputFile, 'utf8');
    const processor = await configRenderer(inputFile, inputFolder, outputFileFolder);
    const file = await processor.process(data);
    const frontMatter = file.data.frontmatter || {};

    // match front matter with tags and return if not match
    const tags = options.tags || [];
    if (tags.length > 0) {
      const shouldRender = tags.every(([key, value]) => {
        if (value === 'true') {
          return frontMatter[key] && frontMatter[key].toString() === value
        } else if (value === 'false') {
          return !frontMatter[key] || frontMatter[key].toString() !== 'true' 
        } else {
          return true;
        }
      });
      console.log("Frontmatter::::", frontMatter, tags, shouldRender);
      if (!shouldRender) {
        console.log(chalk.yellow(`Skipped: ${inputFile}`));
        return;
      }
    }

    const htmlContent = String(file.value);

    const title = file.data.meta.title || frontMatter.title || inputFileName;

    if (Object.keys(frontMatter).length > 0) {
      console.log(chalk.blueBright('Front Matter:'), frontMatter);
    }

    try {
      await fs.access(outputFileFolder);
    } catch (error) {
      await fs.mkdir(outputFileFolder, { recursive: true });
    }

    const templatePath = await findLayout(inputFile, inputFolder);
    const htmlOutput = await renderHtml(templatePath, {title, ...frontMatter, content: htmlContent});
    await fs.writeFile(outputFilePath, htmlOutput);

    console.log(chalk.greenBright(`Rendered: ${outputFilePath}`));
  } catch (err) {
    console.error(chalk.red(`Error processing file ${inputFile}:`), err);
  }
};

const renderHtml = async (templatePath, { title, content }) => {
  const template = await fs.readFile(templatePath, 'utf8');
  const rendered = mustache.render(template, { title, content });
  return rendered;
};
