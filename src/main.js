import fs from 'fs/promises';
import { marked } from 'marked';
import matter from 'gray-matter';
import path from 'path';
import { glob } from 'glob';

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

// export const fileToHtml = (inputFile, outputFolder = './dist/', options = {}) => {
//   console.log(inputFile, "found file");
//   return "file"
// }

export const fileToHtml = async (inputFile, outputFolder = './dist/', options = {}) => {
  console.log("Converting: ", inputFile, outputFolder);
  try {
    const data = await fs.readFile(inputFile, 'utf8');

    const parsedMarkdown = matter(data);
      
    await configImagePath('assets', inputFile);

    // Convert Markdown to HTML using marked
    const htmlContent = marked(parsedMarkdown.content);
    const frontMatter = parsedMarkdown.data;

    const { title = 'Untitled' } = frontMatter;
    // Log Front Matter to Console
    console.log('Front Matter:', frontMatter);

    const inputFileName = path.parse(inputFile).name;

    const outputFileName = (frontMatter.slug && `${frontMatter.slug}.html`) || `${inputFileName}.html`;

    try {
      await fs.access(outputFolder);
    } catch (error) {
      await fs.mkdir(outputFolder, { recursive: true });
    }

    const outputFilePath = path.join(outputFolder, outputFileName);

    const htmlOutput = wrapHtml(title, htmlContent);
      
    await fs.writeFile(outputFilePath, htmlOutput);

    console.log(`Conversion complete! Output saved to ${outputFilePath}`);
  } catch (err) {
    console.error(`Error processing file ${inputFile}:`, err);
  }
};

// Load Markdown file and convert it to HTML
export const markdownToHtml = async (inputPattern, outputFolder, options = {}) => {
  try {
    const globOptions = {
      cwd: process.cwd(),
    };
    const files = await glob(inputPattern, globOptions);
    await Promise.all(files.map(file => fileToHtml(file, outputFolder, options)));
  } catch (err) {
    console.error('Error converting Markdown to HTML:', err);
  }
};

// Wrap the HTML content with necessary HTML & Tailwind tags
const wrapHtml = (title, content) => {
  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp"></script>
    <title>${title}</title>
  </head>
  <body>
    <main  class="prose lg:prose-xl max-w-full mx-auto p-24">
      <h1>${title}</h1>
      ${content}
    </main>
  </body>
  </html>
  `;
};