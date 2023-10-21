import fs from 'fs/promises';
import { marked } from 'marked';
import matter from 'gray-matter';
import path from 'path';
import mustache from 'mustache';
import { fileURLToPath } from 'url';

const configImagePath = (imageDir = 'assets', currentFile) => {
  // Create a custom renderer
  const renderer = new marked.Renderer();

  // Override the image renderer
  renderer.image = async function (href, title, text) {
    // Prepend 'assets/' to the image path
    const targetHref = path.join(imageDir, href);
    const outputDir = path.join('./dist/', imageDir);
    // Create the output directory if it doesn't exist
    try {
      await fs.access(outputDir);
    } catch (error) {
      await fs.mkdir(outputDir, { recursive: true });
    }
    const outputFolder = path.join('./dist/', imageDir, href);

    // Get current file's directory
    const currentFileDir = path.dirname(currentFile);
    // Get the relative path from the current file to the image
    const imagePath = path.join(currentFileDir, href);

    await fs.cp(imagePath, outputFolder);
    return `<img src="${targetHref}" alt="${text}" title="${title || text}">`;
  };

  // Use the custom renderer
  marked.setOptions({ renderer });
}

export const fileToHtml = async (inputFile, outputFileFolder, options = {}) => {
  console.log("Converting: ", inputFile, outputFileFolder);
  try {
    const data = await fs.readFile(inputFile, 'utf8');

    const parsedMarkdown = matter(data);
      
    await configImagePath('assets', inputFile);

    // Convert Markdown to HTML using marked
    const htmlContent = marked(parsedMarkdown.content);
    const frontMatter = parsedMarkdown.data;

    // Log Front Matter to Console
    console.log('Front Matter:', frontMatter);

    const inputFileName = path.parse(inputFile).name;

    const outputFileName = (frontMatter.slug && `${frontMatter.slug}.html`) || `${inputFileName}.html`;

    try {
      await fs.access(outputFileFolder);
    } catch (error) {
      await fs.mkdir(outputFileFolder, { recursive: true });
    }

    const { templatePath } = options;

    const htmlOutput = await renderHtml(templatePath, {title: 'Untitled', ...frontMatter, content: htmlContent});
    
    const outputFilePath = path.join(outputFileFolder, outputFileName);
    
    await fs.writeFile(outputFilePath, htmlOutput);

    console.log(`Conversion complete! Output saved to ${outputFilePath}`);
  } catch (err) {
    console.error(`Error processing file ${inputFile}:`, err);
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Wrap the HTML content with necessary HTML & Tailwind tags
const renderHtml = async (templatePath, { title, content }) => {
  templatePath = templatePath || path.join(__dirname, './static/default_layout.html');
  const template = await fs.readFile(templatePath, 'utf8');
  const rendered = mustache.render(template, { title, content });
  console.log("render complete");
  return rendered;
};